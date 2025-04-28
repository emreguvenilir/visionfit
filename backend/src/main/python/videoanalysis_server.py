from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from videoanalysis import analyze_lift

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
    results = analyze_lift(video_save_path, athlete_height_ft)

    # 5. Return results as JSON
    return jsonify(results)

if __name__ == '__main__':
    app.run(port=5001, debug=True)
