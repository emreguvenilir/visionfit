import cv2
import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import find_peaks
from statistics import stdev
import os

def analyze_squat_side(video_path, athlete_height_ft):
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)

    if not cap.isOpened():
        print("Error: Cannot open video.")
        return

    athlete_height_px = 400.0
    pixels_per_foot = athlete_height_px / athlete_height_ft

    prev_gray = None
    roi_box = None
    motion_over_time = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.resize(frame, (900, 600))
        frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        if roi_box is None:
            h, w = frame.shape[:2]
            roi_box = (int(w * 0.30), int(h * 0.12), int(w * 0.52), int(h * 0.76))

        x, y, rw, rh = roi_box
        roi_frame = blurred[y:y+rh, x:x+rw]

        if prev_gray is not None:
            prev_roi = prev_gray[y:y+rh, x:x+rw]
            diff = cv2.absdiff(roi_frame, prev_roi)
            _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)

            motion_pixels = np.sum(thresh) / 255
            motion_over_time.append(motion_pixels)

            cv2.rectangle(frame, (x, y), (x+rw, y+rh), (0, 255, 0), 2)
            cv2.imshow("Motion Mask", thresh)

        prev_gray = blurred.copy()
        cv2.imshow("Lift Frame", frame)

        if cv2.waitKey(30) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

    return process_motion_signal(motion_over_time, fps)

def process_motion_signal(motion_signal, fps):
    signal = np.array(motion_signal)
    smoothed = cv2.blur(signal.reshape(-1, 1), (15, 1)).flatten()

    peaks, _ = find_peaks(smoothed, distance=10)
    valleys, _ = find_peaks(-smoothed, distance=10)

    # Filter out valleys too close together (e.g., under 15 frames)
    min_distance = 15
    filtered_valleys = []
    for i, v in enumerate(valleys):
        if i == 0 or v - valleys[i - 1] > min_distance:
            filtered_valleys.append(v)
    valleys = np.array(filtered_valleys)

    # Measure motion per rep
    rep_speeds = []
    for i in range(1, len(valleys)):
        start = valleys[i - 1]
        end = valleys[i]
        rep_motion = smoothed[start:end]
        if len(rep_motion) == 0:
            continue
        avg = np.mean(rep_motion)
        rep_speeds.append(avg)

    avg_speed = np.mean(rep_speeds) if rep_speeds else 0
    max_speed = np.max(rep_speeds) if rep_speeds else 0

    # Fatigue Index – capped to non-negative
    fatigue = 0
    if len(rep_speeds) >= 2:
        fatigue = ((rep_speeds[0] - rep_speeds[-1]) / rep_speeds[0]) * 100
        fatigue = max(fatigue, 0)

    # Time Under Tension
    tut = len(np.where(smoothed > np.mean(smoothed) * 0.5)[0]) / fps

    # Plot for debugging (can remove later)
    plt.figure()
    plt.plot(smoothed)
    plt.title("Motion Intensity Over Time")
    plt.xlabel("Frame")
    plt.ylabel("Motion Pixels")
    plt.draw()
    plt.close()

    save_motion_plot(smoothed, "motion_plot.png")

    return {
        "avg_bar_speed": avg_speed,
        "max_bar_speed": max_speed,
        "fatigue_index": fatigue,
        "consistency_score": stdev(rep_speeds) if len(rep_speeds) > 1 else 0,
        "time_under_tension": round(tut, 2),
        "velocity_profile": smoothed.tolist(),
        "valley_indices": valleys.tolist(),
        "fps": fps,
        "rep_speeds": rep_speeds
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
    
def save_motion_plot(smoothed_signal, save_path="motion_plot.png"):
    plt.figure(figsize=(10, 4))
    plt.plot(smoothed_signal, color='blue', linewidth=2)
    plt.title("Motion Intensity Over Time")
    plt.xlabel("Frame")
    plt.ylabel("Motion Pixels")
    plt.grid(True)
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()

