import cv2
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Safe for Flask
import scipy.signal as signal
from statistics import stdev
import os


def analyze_squat_side(video_path, athlete_height_ft, debug=False, flip=False):
    import cv2
    import numpy as np

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0 or fps > 120:
        print(f"[⚠️ FPS Warning] Invalid FPS detected ({fps}). Using fallback 30 FPS.")
        fps = 30
    else:
        print(f"[🎥 FPS Detected] {fps:.2f} frames per second.")
    if not cap.isOpened():
        print("Error: Cannot open video.")
        return

    # Approximate height scaling for bar path → real distance conversion
    athlete_height_px = 400.0
    pixels_per_foot = athlete_height_px / athlete_height_ft
    prev_gray = None
    roi_box = None
    bar_y_trace = []

    print("Analyzing video..." + (" (debug mode ON)" if debug else ""))

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Normalize size
        frame = cv2.resize(frame, (900, 600))
        frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)

        # ✅ Flip horizontally if recording from right side
        if flip:
            frame = cv2.flip(frame, 1)

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        if roi_box is None:
            h, w = frame.shape[:2]
            # Slightly adjusted ROI: more centered for flexibility
            roi_box = (int(w * 0.25), int(h * 0.12), int(w * 0.50), int(h * 0.76))

        x, y, rw, rh = roi_box
        roi_now = blurred[y:y+rh, x:x+rw]

        if prev_gray is not None:
            roi_prev = prev_gray[y:y+rh, x:x+rw]
            diff = cv2.absdiff(roi_now, roi_prev)
            _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)

            col_activity = np.sum(thresh, axis=0)
            bar_x = int(np.argmax(col_activity))
            band_left = max(0, bar_x - 8)
            band_right = min(rw, bar_x + 8)
            band = thresh[:, band_left:band_right]

            if np.sum(band) > 0:
                ys = np.arange(band.shape[0]).reshape(-1, 1)
                y_centroid = float((ys * (band > 0)).sum() / (band > 0).sum())
                bar_y_trace.append(y + y_centroid)

                if debug:
                    cv2.circle(frame, (x + bar_x, int(y + y_centroid)), 6, (0, 255, 0), -1)
                    cv2.rectangle(frame, (x+band_left, y), (x+band_right, y+rh), (255, 0, 0), 1)
            else:
                # Hold last valid value to avoid spikes
                bar_y_trace.append(bar_y_trace[-1] if bar_y_trace else y + rh / 2)

        if debug:
            cv2.rectangle(frame, (x, y), (x+rw, y+rh), (0, 255, 255), 2)
            cv2.imshow("VisionFit Analyzer", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                print("⛔ Analysis manually stopped.")
                break

        prev_gray = blurred.copy()

    cap.release()
    if debug:
        cv2.destroyAllWindows()

    print("✅ Analysis complete.")
    return process_bar_trace(bar_y_trace, fps, pixels_per_foot)



def process_bar_trace(bar_y_trace, fps, pixels_per_foot):
    if len(bar_y_trace) < 3:
        return {
            "avg_bar_speed": 0.0,
            "max_bar_speed": 0.0,
            "fatigue_index": 0.0,
            "consistency_score": 0.0,
            "time_under_tension": 0.0,
            "velocity_over_time": [],
            "fps": fps,
            "pixels_per_foot": pixels_per_foot,
            "rep_speeds": []
        }

    # --- Position smoothing ---
    pos = np.array(bar_y_trace, dtype=np.float32)
    pos_smoothed = cv2.blur(pos.reshape(-1, 1), (9, 1)).flatten()

    # --- Velocity (pixels / frame) ---
    vel = np.gradient(pos_smoothed)

    # 🧹 1) Median filter kills single-frame spikes
    vel = cv2.medianBlur(vel.astype(np.float32).reshape(-1, 1), 5).flatten()

    # 🪶 2) Light blur for consistency
    vel_smoothed = cv2.blur(vel.reshape(-1, 1), (7, 1)).flatten()

    # 🚦 3) Clip to biomechanically realistic range (–15 ↔ 15 px/frame)
    vel_smoothed = np.clip(vel_smoothed, -15, 15)

    # --- Rep segmentation (valleys = bottom of squats) ---
    valleys, _ = signal.find_peaks(-pos_smoothed, distance=max(5, int(fps / 3)))
    rep_boundaries = valleys.tolist()

    rep_speeds_px = []
    for i in range(1, len(valleys)):
        s, e = valleys[i - 1], valleys[i]
        seg = np.abs(vel_smoothed[s:e])
        if len(seg) > 0:
            rep_speeds_px.append(float(np.mean(seg)))

    avg_px = float(np.mean(rep_speeds_px)) if rep_speeds_px else 0.0
    max_px = float(np.max(rep_speeds_px)) if rep_speeds_px else 0.0

    # --- Fatigue logic: positive = slowdown, negative = speed-up ---
    fatigue = 0.0
    if len(rep_speeds_px) >= 2 and rep_speeds_px[0] > 0:
        fatigue = 100.0 * (rep_speeds_px[0] - rep_speeds_px[-1]) / rep_speeds_px[0]
        fatigue = max(-50.0, min(100.0, fatigue))

    # --- Consistency (1 – coefficient of variation) ---
    if len(rep_speeds_px) > 1 and avg_px > 0:
        cons = 1.0 - (stdev(rep_speeds_px) / avg_px)
        consistency = float(min(1.0, max(0.0, cons)))
    else:
        consistency = 1.0 if rep_speeds_px else 0.0

    # --- Time under tension (frames above ½ mean velocity magnitude) ---
    abs_vel = np.abs(vel_smoothed)
    tut_frames = int(np.sum(abs_vel > 0.5 * np.mean(abs_vel))) if abs_vel.size else 0
    tut_seconds = round(tut_frames / fps, 2)

    # Additional smoothing to flatten small jitters in single-rep velocity
    vel_smoothed = signal.savgol_filter(vel_smoothed, window_length=15, polyorder=3, mode='interp')

    return {
        "avg_bar_speed_px_per_frame": avg_px,
        "max_bar_speed_px_per_frame": max_px,
        "fatigue_index": fatigue,
        "consistency_score": consistency,
        "time_under_tension": tut_seconds,
        "velocity_over_time_px_per_frame": vel_smoothed.tolist(),
        "rep_boundaries": rep_boundaries,
        "fps": fps,
        "pixels_per_foot": pixels_per_foot,
        "rep_speeds": rep_speeds_px
    }


def analyze_squat_front(video_path, athlete_height_ft):
    print("Placeholder: squat front logic not yet implemented.")


def analyze_deadlift_side(video_path, athlete_height_ft):
    print("Placeholder: deadlift side logic not yet implemented.")


def analyze_deadlift_front(video_path, athlete_height_ft):
    print("Placeholder: deadlift front logic not yet implemented.")


def analyze_lift(video_path, lift_type, camera_angle, athlete_height_ft):
    if lift_type == 'squat' and camera_angle == 'side':
        return analyze_squat_side(video_path, athlete_height_ft)
    elif lift_type == 'squat' and camera_angle == 'front':
        return analyze_squat_front(video_path, athlete_height_ft)
    elif lift_type == 'deadlift' and camera_angle == 'side':
        return analyze_deadlift_side(video_path, athlete_height_ft)
    elif lift_type == 'deadlift' and camera_angle == 'front':
        return analyze_deadlift_front(video_path, athlete_height_ft)
    else:
        raise ValueError("Unsupported lift type or camera angle.")
