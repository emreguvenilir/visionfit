const GEMINI_API_KEY = "AIzaSyBFESkUAiF9L2fJ-NADes31Io0x6Cpg-GI";

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

    let lifts = {}; //key: liftId, value: liftData
    let liftCount = 0;

    function displayLiftDetails(liftIndex) {
        const lift = lifts[liftIndex];
        if (!lift) return;

        // Update lift details
        $("#liftDetailsTitle").text(`Lift ${liftIndex + 1} Details`);
        $("#detailLiftType").text(lift.liftType);
        $("#detailHeight").text(`${lift.userHeightFeet} ft ${lift.userHeightInches} in`);
        $("#detailWeight").text(`${lift.userWeight} ${lift.weightUnit}`);
        $("#detailSex").text(lift.userSex);
        $("#detailLiftWeight").text(`${lift.liftWeight} ${lift.liftUnit}`);
        $("#detailRpe").text(lift.rpe);
        $("#detailReps").text(lift.reps);
        $("#geminiText").text(lift.geminiAnalysis || "No analysis available.");

        // Update performance metrics
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
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
    }


    uploadBtn.addEventListener('click', function () {
        uploadModal.style.display = 'block';
    });

    window.closeModal = function () {
        uploadModal.style.display = 'none';
        liftForm.reset();
        filePreview.style.display = 'none';
        fileNameSpan.textContent = 'No file chosen';
    };

    window.closeAnalysisModal = function () {
        analysisModal.style.display = 'none';
    };

    fileInput.addEventListener('change', function () {
        if (fileInput.files.length > 0) {
            fileNameSpan.textContent = fileInput.files[0].name;
            filePreview.style.display = 'block';
        } else {
            fileNameSpan.textContent = 'No file chosen';
            filePreview.style.display = 'none';
        }
    });

    liftForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        loadingModal.style.display = 'block';
        const formData = new FormData(liftForm);
        console.log('Form Data:');
        for (let [key, value] of formData.entries()) {
            console.log(`${key}: ${value}`);
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            console.log('Sending fetch request to http://127.0.0.1:5001/analyze_lift...');

            const response = await fetch('http://127.0.0.1:5001/analyze_lift', {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('Fetch request completed. Response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
            }

            const result = await response.json();
            console.log('API Response:', result);

            
            let analysisText = "No analysis available.";

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

                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

                try {
                    const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                    });

                    if (!response.ok) throw new Error(`Gemini API request failed: ${response.statusText}`);

                    const data = await response.json();
                    const geminiOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "No feedback generated.";

                    // ✅ set dynamically, not returned
                    analysisText = geminiOutput;
                    $("#geminiText").text(geminiOutput);

                } catch (error) {
                    console.error("Error generating Gemini lift feedback:", error);
                    analysisText = "Unable to generate feedback right now. Try again later.";
                    $("#geminiText").text(analysisText);
                }
            }

            await generateGeminiLiftFeedback({
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


            //velocity graph
            // After receiving the `result` JSON:
            const velocityData = result.velocity_over_time;
            if (velocityData && velocityData.length > 0) {
                const ctx = document.getElementById('velocityGraph').getContext('2d');
                if (window.velocityChart) window.velocityChart.destroy(); // clear old chart

                window.velocityChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: velocityData.map((_, i) => i),
                        datasets: [{
                            label: 'Velocity (relative units)',
                            data: velocityData,
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
                        plugins: {
                            legend: { display: false }
                        }
                    }
                });
            }

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
            }

            const currentIndex = liftCount;
            // Add new lift to sidebar
            $("#liftList").append(
            $("<li>")
                .addClass("lift-item")
                .append(
                $("<div>")
                    .addClass("lift-box")
                    .append($("<span>").addClass("lift-name").text(`Lift ${currentIndex+1}`))
                    .append($("<i>").addClass("fas fa-chevron-right lift-arrow"))
                )
                .on("click", () => {
                displayLiftDetails(currentIndex);
                })
            );


            let modalHTML = `
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

            document.getElementById("analysisContent").innerHTML = modalHTML;
            analysisModal.style.display = 'block';

            displayLiftDetails(liftCount);
            liftCount++;

            loadingModal.style.display = 'none';

            closeModal();
        } catch (error) {
            console.error('Fetch Error Details:', error);
            loadingModal.style.display = 'none';
            if (error.name === 'AbortError') {
                alert('Error analyzing lift: Request timed out after 30 seconds. Please ensure the server is running on http://127.0.0.1:5001, check for errors in the server logs, and try uploading a shorter video.');
            } else {
                alert(`Error analyzing lift: ${error.message}. Please ensure the server is running on http://127.0.0.1:5001 and CORS is enabled.`);
            }
        }
    });
});