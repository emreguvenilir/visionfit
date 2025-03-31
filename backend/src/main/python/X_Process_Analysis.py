import cv2
import numpy as np

# Calibration
fps = 30
athlete_height_ft = 5.58
athlete_height_px = 400.0
pixels_per_foot = athlete_height_px / athlete_height_ft

# Tracking vars
prev_gray = None
speed_readings = []
max_speed = 0.0
min_speed_threshold = 0.3  # Ignore background twitching

# Video path
video_path = r"C:\Users\eguve\OneDrive\Desktop\VisionFit\backend\src\main\python\DLTest.MP4"
cap = cv2.VideoCapture(video_path)

if not cap.isOpened():
    print("Error: Cannot open video file.")
    exit()

while True:
    ret, frame = cap.read()
    if not ret:
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    if prev_gray is not None:
        diff = cv2.absdiff(blurred, prev_gray)
        _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)

        # Count motion pixels
        motion_pixels = np.sum(thresh) / 255
        avg_pixel_motion = motion_pixels / (frame.shape[0] * frame.shape[1])

        motion_pixels_per_frame = avg_pixel_motion * frame.shape[1]
        motion_feet_per_second = (motion_pixels_per_frame * fps) / pixels_per_foot
        motion_mph = motion_feet_per_second * 0.681818

        # Track max and add to list if it's above threshold
        if motion_mph > min_speed_threshold:
            speed_readings.append(motion_mph)
            max_speed = max(max_speed, motion_mph)

        # Display current speed
        cv2.putText(frame, f"Speed: {motion_mph:.2f} MPH", (30, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

        # Display max/avg speed
        if speed_readings:
            avg_speed = sum(speed_readings) / len(speed_readings)
            cv2.putText(frame, f"Max: {max_speed:.2f} MPH", (30, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(frame, f"Avg: {avg_speed:.2f} MPH", (30, 90),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

        cv2.imshow("Motion Mask", thresh)

    cv2.imshow("Speed Tracker", frame)
    prev_gray = blurred.copy()

    if cv2.waitKey(30) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()

# Print at the end
if speed_readings:
    print(f"\n=== LIFT SUMMARY ===")
    print(f"Max speed: {max_speed:.2f} MPH")
    print(f"Avg speed (above {min_speed_threshold} MPH): {sum(speed_readings)/len(speed_readings):.2f} MPH")
else:
    print("No significant motion detected.")
