from flask import Flask, request, jsonify
from flask_cors import CORS
from videoanalysis import analyze_lift
from statistics import stdev
import os

app = Flask(__name__)
CORS(app)  # <-- ALLOW cross-origin requests

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

    # 3. Convert height
    athlete_height_ft = height_feet + (height_inches / 12)

    # 4. Call video analysis
    results = analyze_lift(video_save_path,"squat" ,"side",athlete_height_ft)
    #analyze_lift(video_path, lift_type, camera_angle, athlete_height_ft)

    rep_speeds_px = results['rep_speeds']
    fps = results['fps']
    tut = results['time_under_tension']
    valleys = results['valley_indices']

    pixels_per_foot = 400.0 / athlete_height_ft
    motion_scale = 0.0008  # Adjust this as needed to calibrate MPH output
    rep_speeds_mph = [(s * motion_scale * fps / pixels_per_foot) * 0.681818 for s in rep_speeds_px]
    avg_speed_mph = sum(rep_speeds_mph) / len(rep_speeds_mph) if rep_speeds_mph else 0
    max_speed_mph = max(rep_speeds_mph) if rep_speeds_mph else 0

    fatigue_index = (
        100 * (rep_speeds_mph[0] - rep_speeds_mph[-1]) / rep_speeds_mph[0]
        if len(rep_speeds_mph) >= 2 else 0
    )

    consistency = (
        1 - (stdev(rep_speeds_mph) / avg_speed_mph)
        if len(rep_speeds_mph) > 1 else 1.0
    )

    # 5. Return results as JSON
    return jsonify({
        'avg_speed_mph': avg_speed_mph,
        'max_speed_mph': max_speed_mph,
        'fatigue_index': fatigue_index,
        'consistency_score': consistency,
        'time_under_tension': tut,

    })

if __name__ == '__main__':
    app.run(port=5001, debug=True)
