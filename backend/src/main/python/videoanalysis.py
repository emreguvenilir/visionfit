import cv2
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Safe for Flask
import scipy.signal as signal
from statistics import stdev
import os

def analyze_squat_side(video_path, athlete_height_ft, debug=False, flip=False):
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

    # --- Read first frame for setup ---
    ret, first_frame = cap.read()
    if not ret:
        print("Error: Cannot read first frame.")
        return
    h0, w0 = first_frame.shape[:2]

    # Auto-rotate if horizontal
    if w0 > h0:
        first_frame = cv2.rotate(first_frame, cv2.ROTATE_90_CLOCKWISE)
        rotated = True
    else:
        rotated = False

    frame_h, frame_w = first_frame.shape[:2]
    athlete_height_px = frame_h * 0.6
    pixels_per_foot = athlete_height_px / athlete_height_ft
    print(f"[📏 Scale] Athlete height ≈ {athlete_height_px:.1f}px → {pixels_per_foot:.2f} px/ft")

    # Default ROI (center band)
    roi_box = (int(frame_w * 0.15), int(frame_h * 0.10),
               int(frame_w * 0.70), int(frame_h * 0.80))
    print(f"[🎯 ROI Default] {roi_box}")

    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    prev_gray = None
    bar_y_trace = []
    frame_count = 0

    print("Analyzing video..." + (" (debug mode ON)" if debug else ""))

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame_count += 1

        if rotated:
            frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
        if flip:
            frame = cv2.flip(frame, 1)

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

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
                bar_y_trace.append(bar_y_trace[-1] if bar_y_trace else y + rh / 2)

        if debug:
            # shrink window for viewing
            display = cv2.resize(frame, (int(frame_w * 0.6), int(frame_h * 0.6)))
            cv2.rectangle(display, (int(x*0.6), int(y*0.6)),
                          (int((x+rw)*0.6), int((y+rh)*0.6)), (0, 255, 255), 2)
            cv2.imshow("VisionFit Analyzer", display)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        prev_gray = blurred.copy()

    cap.release()
    if debug:
        cv2.destroyAllWindows()

    print(f"✅ Analysis complete. Frames processed: {frame_count}")
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

    pos = np.array(bar_y_trace, dtype=np.float32)
    pos_smoothed = cv2.blur(pos.reshape(-1, 1), (9, 1)).flatten()
    vel = np.gradient(pos_smoothed)
    vel = cv2.medianBlur(vel.astype(np.float32).reshape(-1, 1), 5).flatten()
    vel_smoothed = cv2.blur(vel.reshape(-1, 1), (7, 1)).flatten()
    vel_smoothed = np.clip(vel_smoothed, -15, 15)

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

    fatigue = 0.0
    # find max rep speed
    if rep_speeds_px:
        fastest = max(rep_speeds_px)
        last = rep_speeds_px[-1]
        fatigue = (fastest - last) / fastest * 100.0
        fatigue = round(fatigue, 1)
    else:
        fatigue = 0.0

    abs_vel = np.abs(vel_smoothed)
    tut_frames = int(np.sum(abs_vel > 0.5 * np.mean(abs_vel))) if abs_vel.size else 0
    tut_seconds = round(tut_frames / fps, 2)

    vel_smoothed = signal.savgol_filter(vel_smoothed, window_length=15, polyorder=3, mode='interp')

    return {
        "avg_bar_speed_px_per_frame": avg_px,
        "max_bar_speed_px_per_frame": max_px,
        "fatigue_index": fatigue,
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
