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

    // Open upload modal
    uploadBtn.addEventListener('click', function () {
        uploadModal.style.display = 'block';
    });

    // Close upload modal
    window.closeModal = function () {
        uploadModal.style.display = 'none';
        liftForm.reset();
        filePreview.style.display = 'none';
        fileNameSpan.textContent = 'No file chosen';
    };

    // Close analysis modal
    window.closeAnalysisModal = function () {
        analysisModal.style.display = 'none';
    };

    // Show file name when a file is selected
    fileInput.addEventListener('change', function () {
        if (fileInput.files.length > 0) {
            fileNameSpan.textContent = fileInput.files[0].name;
            filePreview.style.display = 'block';
        } else {
            fileNameSpan.textContent = 'No file chosen';
            filePreview.style.display = 'none';
        }
    });

    // Handle form submission
    liftForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        // Show loading modal
        loadingModal.style.display = 'block';

        // Create FormData object to collect form data
        const formData = new FormData(liftForm);
        
        // Log form data for debugging
        console.log('Form Data:');
        for (let [key, value] of formData.entries()) {
            console.log(`${key}: ${value}`);
        }

        try {
            // Add a timeout to the fetch request (30 seconds)
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

            // Log the API response for debugging
            console.log('API Response:', result);

            // Update table cells with response
            document.getElementById('avgSpeedCell').textContent = result.avg_speed_mph ? `${result.avg_speed_mph.toFixed(2)} mph` : '...';
            document.getElementById('maxSpeedCell').textContent = result.max_speed_mph ? `${result.max_speed_mph.toFixed(2)} mph` : '...';
            document.getElementById('avgForcePowerCell').textContent = '...'; // Still not implemented
            document.getElementById('fatigueIndexCell').textContent = result.fatigue_index ? `${result.fatigue_index.toFixed(2)}%` : '...';
            document.getElementById('consistencyScoreCell').textContent = result.consistency_score ? `${result.consistency_score.toFixed(2)*100}%` : '...';
            document.getElementById('timeUnderTensionCell').textContent = result.time_under_tension || '...';
            //document.getElementById('velocityProfileCell').textContent = result.velocity_profile ? `${result.velocity_profile.length} pts` : '...';
            

            // Add new lift to sidebar
            const sidebar = document.querySelector('.sidebar');
            const newLift = document.createElement('a');
            const liftDiv = document.createElement('div');
            liftDiv.className = 'cell';
            liftDiv.textContent = `Lift_${sidebar.children.length}`;
            newLift.appendChild(liftDiv);
            sidebar.appendChild(newLift);

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

            // Close the loading modal right before displaying the analysis modal
            loadingModal.style.display = 'none';

            // Display the analysis in the modal
            analysisContent.innerHTML = analysisText;
            analysisModal.style.display = 'block';

            // Close upload modal and reset form
            closeModal();
        } catch (error) {
            console.error('Fetch Error Details:', error);
            loadingModal.style.display = 'none'; // Ensure loading modal closes on error
            if (error.name === 'AbortError') {
                alert('Error analyzing lift: Request timed out after 30 seconds. Please ensure the server is running on http://127.0.0.1:5001, check for errors in the server logs, and try uploading a shorter video.');
            } else {
                alert(`Error analyzing lift: ${error.message}. Please ensure the server is running on http://127.0.0.1:5001 and CORS is enabled.`);
            }
        }
    });
});