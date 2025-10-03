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

            // Generate Gemini-style analysis
            let analysisText = "<h3>Lift Performance Analysis</h3>";
            analysisText += "<p>Here’s a detailed breakdown of your lift based on the analyzed metrics:</p>";

            // Analyze average and max speed
            if (result.avg_speed_mph && result.max_speed_mph) {
                const avgSpeed = parseFloat(result.avg_speed_mph);
                const maxSpeed = parseFloat(result.max_speed_mph);
                analysisText += `<p><strong>Average Bar Speed:</strong> ${avgSpeed.toFixed(2)} mph<br>`;
                analysisText += `Your average bar speed indicates the overall pace of your lift. A speed of ${avgSpeed.toFixed(2)} mph suggests a ${avgSpeed > 0.5 ? "solid" : "slower"} pace, which is ${avgSpeed > 0.5 ? "good for building strength" : "an area to improve for explosive power"}.</p>`;
                analysisText += `<p><strong>Max Bar Speed:</strong> ${maxSpeed.toFixed(2)} mph<br>`;
                analysisText += `Your peak speed of ${maxSpeed.toFixed(2)} mph shows your explosive capability. A higher max speed relative to your average (${maxSpeed / avgSpeed > 1.5 ? "indicates good explosiveness" : "suggests a more controlled lift"}).</p>`;
            }

            // Analyze time under tension
            if (result.time_under_tension) {
                const timeUnderTension = parseFloat(result.time_under_tension);
                analysisText += `<p><strong>Time Under Tension:</strong> ${result.time_under_tension}<br>`;
                analysisText += `You maintained tension for ${result.time_under_tension}, which is ${timeUnderTension > 5 ? "excellent for muscle endurance" : "on the shorter side, possibly indicating a quicker lift"}.</p>`;
            }

            // Analyze consistency score
            if (result.consistency_score) {
                const consistencyScore = parseFloat(result.consistency_score);
                analysisText += `<p><strong>Consistency Score:</strong> ${result.consistency_score.toFixed(2)*100}% <br>`;
                analysisText += `Your consistency score of ${result.consistency_score.toFixed(2)*100}% reflects how steady your lift was. A score above 80% is excellent, indicating smooth execution, while below 60% suggests variability in your movement that might need attention.</p>`;
            }

            // Add recommendations
            analysisText += "<h4>Recommendations</h4>";
            analysisText += "<ul>";
            if (result.avg_speed_mph && parseFloat(result.avg_speed_mph) < 0.5) {
                analysisText += "<li>Focus on increasing your bar speed by incorporating power-focused exercises like speed squats or explosive deadlifts.</li>";
            }
            if (result.consistency_score && parseFloat(result.consistency_score) < 60) {
                analysisText += "<li>Work on maintaining a more consistent speed throughout your lift. Slow down and focus on form to reduce variability.</li>";
            }
            analysisText += "<li>Consider filming your lift from multiple angles to better assess your form and identify areas for improvement.</li>";
            analysisText += "</ul>";

            analysisContent.innerHTML = analysisText;
            analysisModal.style.display = 'block';

            $("#geminiText").html(analysisText);

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
                velocity_profile: result.velocity_over_time
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