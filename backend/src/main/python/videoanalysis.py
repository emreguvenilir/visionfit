import cv2
import numpy as np

def analyze_lift(video_path, athlete_height_ft):
    prev_gray = None
    speed_readings = []
    max_speed = 0.0
    min_speed_threshold = 0.3

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)

    if not cap.isOpened():
        print("Error: Cannot open video file.")
        return {
            "max_speed_mph": 0,
            "avg_speed_mph": 0,
            "fps": 0
        }

    athlete_height_px = 400.0
    pixels_per_foot = athlete_height_px / athlete_height_ft

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        if prev_gray is not None:
            diff = cv2.absdiff(blurred, prev_gray)
            _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)

            motion_pixels = np.sum(thresh) / 255
            avg_pixel_motion = motion_pixels / (frame.shape[0] * frame.shape[1])

            motion_pixels_per_frame = avg_pixel_motion * frame.shape[1]
            motion_feet_per_second = (motion_pixels_per_frame * fps) / pixels_per_foot
            motion_mph = motion_feet_per_second * 0.681818

            if motion_mph > min_speed_threshold:
                speed_readings.append(motion_mph)
                max_speed = max(max_speed, motion_mph)

        prev_gray = blurred.copy()

        if cv2.waitKey(30) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

    if speed_readings:
        avg_speed = sum(speed_readings) / len(speed_readings)
        return {
            "max_speed_mph": max_speed,
            "avg_speed_mph": avg_speed,
            "fps": fps
        }
    else:
        return {
            "max_speed_mph": 0,
            "avg_speed_mph": 0,
            "fps": fps
        }
