// ==================== Development ====================
//const GEMINI_PROXY_URL = "http://127.0.0.1:5001/gemini_proxy";

// ==================== Production ====================
const GEMINI_PROXY_URL = "https://visionfit.onrender.com/gemini_proxy";


// ==================== MAIN DASHBOARD ====================
document.addEventListener('DOMContentLoaded', function () {
    const uploadBtn = document.getElementById('upload-btn');
    const uploadModal = document.getElementById('uploadModal');
    const loadingModal = document.getElementById('loadingModal');
    const analysisModal = document.getElementById('analysisModal');
    const analysisContent = document.getElementById('analysisContent');
    const liftForm = document.getElementById('liftForm');
    const fileInput = document.getElementById('fileUpload');
    const filePreview = document.getElementById('filePreview');
    const fileNameSpan = document.getElementById('fileName');
    

    let lifts = {};
    let liftCount = 0;


    // ==================== DISPLAY DETAILS ====================
    function displayLiftDetails(liftIndex) {
        const lift = lifts[liftIndex];
        if (!lift) return;

        $("#liftDetailsTitle").text(`Lift ${liftIndex + 1} Details`);
        $("#detailLiftType").text(lift.liftType);
        $("#detailHeight").text(`${lift.userHeightFeet} ft ${lift.userHeightInches} in`);
        $("#detailWeight").text(`${lift.userWeight} ${lift.weightUnit}`);
        $("#detailSex").text(lift.userSex);
        $("#detailLiftWeight").text(`${lift.liftWeight} ${lift.liftUnit}`);
        $("#detailRpe").text(lift.rpe);
        $("#detailReps").text(lift.reps);
        $("#geminiText").text(lift.geminiAnalysis || "No analysis available.");

        $("#avgSpeed").text(lift.avgSpeedMph ? `${lift.avgSpeedMph.toFixed(2)} mph` : "-");
        $("#maxSpeed").text(lift.maxSpeedMph ? `${lift.maxSpeedMph.toFixed(2)} mph` : "-");
        $("#consistencyScore").text(lift.consistency_score ? `${(lift.consistency_score * 100).toFixed(1)}%` : "-");
        $("#fatigueIndex").text(lift.fatigue_index ? `${lift.fatigue_index.toFixed(1)}%` : "-");
        $("#timeUnderTension").text(lift.timeUnderTension ? `${lift.timeUnderTension}s` : "-");
        $("#maxPower").text(lift.maxPowerWatts ? `${lift.maxPowerWatts} W` : "-");

        if (lift.velocity_profile && lift.velocity_profile.length > 0) {
            const ctx = document.getElementById('velocityGraph').getContext('2d');
            if (window.velocityChart) window.velocityChart.destroy();

            window.velocityChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: lift.velocity_profile.map((_, i) => i),
                    datasets: [{
                        label: 'Velocity (relative units)',
                        data: lift.velocity_profile,
                        borderColor: '#1abc9c',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        x: { title: { display: true, text: 'Frame' } },
                        y: { title: { display: true, text: 'Relative Velocity' } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    }


    // ==================== GEMINI FEEDBACK ====================
    async function generateGeminiLiftFeedback(result) {
        const prompt = `
        You are a professional strength coach.
        Given the athlete and lift data below, write 3–4 sentences of concise, encouraging feedback
        focused on control, effort, and one key improvement area.

        Athlete:
        - Sex: ${result.userSex}
        - Height: ${result.userHeightFeet} ft ${result.userHeightInches} in
        - Body Weight: ${result.userWeight} ${result.weightUnit}

        Lift:
        - Type: ${result.liftType}
        - Load: ${result.liftWeight} ${result.liftUnit}
        - Reps: ${result.reps}
        - RPE: ${result.rpe}

        Performance:
        - Avg Speed: ${result.avg_speed_mph.toFixed(2)} mph
        - Max Speed: ${result.max_speed_mph.toFixed(2)} mph
        - Consistency: ${(result.consistency_score * 100).toFixed(1)}%
        - Fatigue: ${result.fatigue_index.toFixed(1)}%
        - Time Under Tension: ${result.time_under_tension}s
        - Max Power: ${result.max_power_watts.toFixed(2)} W
        `;

        $("#geminiText").html("<em>Analyzing lift and generating feedback...</em>");

        try {
            const response = await fetch(GEMINI_PROXY_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok)
                throw new Error(`Gemini API request failed: ${response.statusText}`);

            const data = await response.json();
            const geminiOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "No feedback generated.";

            $("#geminiText").text(geminiOutput);
            return geminiOutput;

        } catch (error) {
            console.error("Error generating Gemini lift feedback:", error);
            const fallback = "Unable to generate feedback right now. Try again later.";
            $("#geminiText").text(fallback);
            return fallback;
        }
    }


    // ==================== MODAL CONTROLS ====================
    uploadBtn.addEventListener('click', () => (uploadModal.style.display = 'block'));
    window.closeModal = () => {
        uploadModal.style.display = 'none';
        liftForm.reset();
        filePreview.style.display = 'none';
        fileNameSpan.textContent = 'No file chosen';
    };
    window.closeAnalysisModal = () => (analysisModal.style.display = 'none');

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            fileNameSpan.textContent = fileInput.files[0].name;
            filePreview.style.display = 'block';
        } else {
            fileNameSpan.textContent = 'No file chosen';
            filePreview.style.display = 'none';
        }
    });


    // ==================== SUBMIT LIFT ====================
    liftForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        loadingModal.style.display = 'block';

        const formData = new FormData(liftForm);
        const flipChecked = liftForm.querySelector('input[name="flip"]').checked;
        formData.set('flip', flipChecked ? 'true' : 'false');
        console.log('Form Data:', Object.fromEntries(formData.entries()));

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);
            //use the line below for local testing
            //const response = await fetch('http://127.0.0.1:5001/analyze_lift', {
            const response = await fetch('https://visionfit.onrender.com/analyze_lift', {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok)
                throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);

            const result = await response.json();
            console.log('API Response:', result);

            // === Generate Gemini Feedback ===
            const analysisText = await generateGeminiLiftFeedback({
                ...result,
                userSex: formData.get('userSex'),
                userHeightFeet: formData.get('userHeightFeet'),
                userHeightInches: formData.get('userHeightInches'),
                userWeight: formData.get('userWeight'),
                weightUnit: formData.get('weightUnit'),
                liftType: formData.get('liftType'),
                liftWeight: formData.get('weight'),
                liftUnit: formData.get('unit'),
                rpe: formData.get('rpe'),
                reps: formData.get('reps'),
            });

            // === Store Lift ===
            lifts[liftCount] = {
                liftType: formData.get('liftType'),
                userHeightFeet: formData.get('userHeightFeet'),
                userHeightInches: formData.get('userHeightInches'),
                userWeight: formData.get('userWeight'),
                weightUnit: formData.get('weightUnit'),
                userSex: formData.get('userSex'),
                liftWeight: formData.get('weight'),
                liftUnit: formData.get('unit'),
                rpe: formData.get('rpe'),
                reps: formData.get('reps'),
                avgSpeedMph: result.avg_speed_mph,
                maxSpeedMph: result.max_speed_mph,
                timeUnderTension: result.time_under_tension,
                fatigue_index: result.fatigue_index,
                consistency_score: result.consistency_score,
                geminiAnalysis: analysisText,
                velocity_profile: result.velocity_over_time,
                maxPowerWatts: result.max_power_watts
            };

            // === Add to Sidebar ===
            const currentIndex = liftCount;
            $("#liftList").append(
                $("<li>")
                    .addClass("lift-item")
                    .append(
                        $("<div>")
                            .addClass("lift-box")
                            .append($("<span>").addClass("lift-name").text(`Lift ${currentIndex + 1}`))
                            .append($("<i>").addClass("fas fa-chevron-right lift-arrow"))
                    )
                    .on("click", () => displayLiftDetails(currentIndex))
            );

            // === Display Analysis Modal ===
            const modalHTML = `
                <h3>Performance Summary</h3>
                <ul style="list-style-type:none; padding:0; line-height:1.8;">
                    <li><strong>Lift Type:</strong> ${lifts[liftCount].liftType}</li>
                    <li><strong>Load:</strong> ${lifts[liftCount].liftWeight} ${lifts[liftCount].liftUnit}</li>
                    <li><strong>Reps:</strong> ${lifts[liftCount].reps}</li>
                    <li><strong>RPE:</strong> ${lifts[liftCount].rpe}</li>
                    <li><strong>Average Speed:</strong> ${lifts[liftCount].avgSpeedMph.toFixed(2)} mph</li>
                    <li><strong>Max Speed:</strong> ${lifts[liftCount].maxSpeedMph.toFixed(2)} mph</li>
                    <li><strong>Consistency:</strong> ${(lifts[liftCount].consistency_score * 100).toFixed(1)}%</li>
                    <li><strong>Fatigue Index:</strong> ${lifts[liftCount].fatigue_index.toFixed(1)}%</li>
                    <li><strong>Time Under Tension:</strong> ${lifts[liftCount].timeUnderTension}s</li>
                    <li><strong>Max Power Output:</strong> ${lifts[liftCount].maxPowerWatts.toFixed(2)} W</li>
                </ul>

                <h3>Coach Feedback</h3>
                <p id="geminiText">${lifts[liftCount].geminiAnalysis || "<em>Generating feedback...</em>"}</p>
            `;

            analysisContent.innerHTML = modalHTML;
            analysisModal.style.display = 'block';
            displayLiftDetails(liftCount);

            liftCount++;
            loadingModal.style.display = 'none';
            closeModal();

        } catch (error) {
            console.error('Fetch Error Details:', error);
            loadingModal.style.display = 'none';
            if (error.name === 'AbortError') {
                alert('Request timed out (60s). Try shorter videos or check the backend.');
            } else {
                alert(`Error analyzing lift: ${error.message}`);
            }
        }
    });
});
