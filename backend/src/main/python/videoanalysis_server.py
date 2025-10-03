from flask import Flask, request, jsonify
from flask_cors import CORS
from videoanalysis import analyze_lift
from statistics import stdev
import os
from videoanalysis import analyze_squat_side

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


@app.route('/analyze_lift', methods=['POST'])
def analyze_lift_route():
    # 1. Receive form data
    lift_type = request.form['liftType']
    height_feet = int(request.form['userHeightFeet'])
    height_inches = int(request.form['userHeightInches'])
    user_weight = float(request.form['userWeight'])
    weight_unit = request.form['weightUnit']
    user_sex = request.form['userSex']
    lift_weight = float(request.form['weight'])
    lift_weight_unit = request.form['unit']
    rpe = float(request.form['rpe'])

    # 2. Save uploaded video
    video_file = request.files['fileUpload']
    video_save_path = os.path.join(UPLOAD_FOLDER, video_file.filename)
    video_file.save(video_save_path)

    # 3. Convert height to feet
    athlete_height_ft = height_feet + (height_inches / 12)

    # 4. Run vision analysis
    results = analyze_squat_side(video_save_path, athlete_height_ft, debug=True)

    rep_speeds_px = results['rep_speeds']
    fps = results['fps']
    pixels_per_foot = results['pixels_per_foot']
    tut = results['time_under_tension']

    # Convert from pixels/frame → mph
    rep_speeds_mph = [((v * fps / pixels_per_foot) * 0.681818) for v in rep_speeds_px]
    avg_speed_mph = sum(rep_speeds_mph) / len(rep_speeds_mph) if rep_speeds_mph else 0.0
    max_speed_mph = max(rep_speeds_mph) if rep_speeds_mph else 0.0

    # Fatigue (positive = slowdown, negative = speed-up)
    fatigue_index = 0.0
    if len(rep_speeds_mph) >= 2 and rep_speeds_mph[0] > 0:
        fatigue_index = 100.0 * (rep_speeds_mph[0] - rep_speeds_mph[-1]) / rep_speeds_mph[0]
        fatigue_index = max(-50.0, min(100.0, fatigue_index))

    # Consistency (normalized 0–1)
    consistency = (
        1 - (stdev(rep_speeds_mph) / avg_speed_mph)
        if len(rep_speeds_mph) > 1 and avg_speed_mph > 0 else 1.0
    )
    consistency = max(0.0, min(1.0, consistency))

    # Full velocity trace in mph
    vel_px_trace = results['velocity_over_time_px_per_frame']
    velocity_over_time_mph = [(v * fps / pixels_per_foot) * 0.681818 for v in vel_px_trace]

    # 5. Compute only peak mechanical power (W)
    g = 9.81  # m/s²
    lift_mass_kg = lift_weight if lift_weight_unit.lower() == "kg" else lift_weight * 0.453592
    max_speed_ms = max_speed_mph / 2.23694
    max_power_watts = lift_mass_kg * g * max_speed_ms

    # 6. Return JSON
    return jsonify({
        'avg_speed_mph': round(avg_speed_mph, 2),
        'max_speed_mph': round(max_speed_mph, 2),
        'fatigue_index': round(fatigue_index, 2),
        'consistency_score': round(consistency, 3),
        'time_under_tension': tut,
        'velocity_over_time': velocity_over_time_mph,
        'max_power_watts': round(max_power_watts, 2)
    })


if __name__ == '__main__':
    app.run(port=5001, debug=True)
