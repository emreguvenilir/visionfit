from flask import Flask, request, jsonify
from flask_cors import CORS
from videoanalysis import analyze_lift, analyze_squat_side
from statistics import stdev
import os
import requests
from dotenv import load_dotenv

# ========== Initialization ==========
load_dotenv()  # Loads GEMINI_API_KEY and other vars from .env

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": [
            "https://visionfit-233b.onrender.com",  # your deployed frontend
            "http://localhost:8080"  # optional: for local testing
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

MAX_FILE_SIZE_MB = 40  # adjust as needed
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE_MB * 1024 * 1024

# ====== Error Handling ======
@app.errorhandler(413)
def file_too_large(e):
    return jsonify({
        "error": f"File too large. Maximum allowed size is {MAX_FILE_SIZE_MB} MB."
    }), 413

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/')
def home():
    return "VisionFit backend is running!"

# ========== VisionFit Lift Analysis ==========
@app.route('/analyze_lift', methods=['POST'])
def analyze_lift_route():
    """Analyze a lift video and return performance metrics."""
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

    flip_flag = request.form.get('flip', 'false').lower() == 'true'

    # 5. Run analysis
    results = analyze_squat_side(video_save_path, athlete_height_ft, debug=True, flip=flip_flag)


    rep_speeds_px = results['rep_speeds']
    fps = results['fps']
    pixels_per_foot = results['pixels_per_foot']
    tut = results['time_under_tension']

    # Convert to mph
    rep_speeds_mph = [(v * fps / pixels_per_foot) * 0.681818 for v in rep_speeds_px]
    avg_speed_mph = sum(rep_speeds_mph) / len(rep_speeds_mph) if rep_speeds_mph else 0.0
    max_speed_mph = max(rep_speeds_mph) if rep_speeds_mph else 0.0

    fatigue_index = 0.0
    fatigue_index = results['fatigue_index']

    # Consistency (normalized 0–1)
    consistency = (
        1 - (stdev(rep_speeds_mph) / avg_speed_mph)
        if len(rep_speeds_mph) > 1 and avg_speed_mph > 0 else 1.0
    )
    consistency = max(0.0, min(1.0, consistency))

    # Velocity trace in mph
    vel_px_trace = results['velocity_over_time_px_per_frame']
    velocity_over_time_mph = [(v * fps / pixels_per_foot) * 0.681818 for v in vel_px_trace]

    # Peak mechanical power (W)
    g = 9.81  # m/s²
    lift_mass_kg = lift_weight if lift_weight_unit.lower() == "kg" else lift_weight * 0.453592
    max_speed_ms = max_speed_mph / 2.23694
    max_power_watts = lift_mass_kg * g * max_speed_ms

    rep_frames = results['rep_boundaries']

    # 5. Return JSON
    return jsonify({
        'avg_speed_mph': round(avg_speed_mph, 2),
        'max_speed_mph': round(max_speed_mph, 2),
        'fatigue_index': round(fatigue_index, 2),
        'consistency_score': round(consistency, 3),
        'time_under_tension': tut,
        'velocity_over_time': velocity_over_time_mph,
        'max_power_watts': round(max_power_watts, 2),
        'rep_boundaries': rep_frames
    })


# ========== Gemini Proxy ==========
@app.route('/gemini_proxy', methods=['POST'])
def gemini_proxy():
    """Secure proxy to call the Gemini API from backend (bypasses browser CORS)."""
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

    if not GEMINI_API_KEY:
        return jsonify({"error": "Gemini API key not configured on server"}), 500

    try:
        payload = request.get_json(force=True)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"
        headers = {"Content-Type": "application/json"}

        # Forward request to Gemini
        response = requests.post(url, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        gemini_data = response.json()
        return jsonify(gemini_data)

    except requests.exceptions.RequestException as e:
        print("Gemini proxy error:", e)
        return jsonify({"error": f"Gemini API request failed: {str(e)}"}), 500
    except Exception as e:
        print("Unexpected Gemini proxy error:", e)
        return jsonify({"error": str(e)}), 500
    

# ========== CalorieNinjas Proxy ==========
@app.route('/calories_proxy', methods=['GET'])
def calories_proxy():
    """Secure proxy to fetch nutrition data via backend."""
    CALORIE_NINJAS_API_KEY = os.getenv("CALORIE_NINJAS_API_KEY")

    if not CALORIE_NINJAS_API_KEY:
        return jsonify({"error": "CalorieNinjas API key not configured"}), 500

    try:
        query = request.args.get("query")
        if not query:
            return jsonify({"error": "Missing 'query' parameter"}), 400

        url = f"https://api.calorieninjas.com/v1/nutrition?query={query}"
        headers = {"X-Api-Key": CALORIE_NINJAS_API_KEY}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        print("CalorieNinjas proxy error:", e)
        return jsonify({"error": f"CalorieNinjas API request failed: {str(e)}"}), 500


# ========== Server Start ==========
if __name__ == '__main__':
    port = int(os.getenv("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
