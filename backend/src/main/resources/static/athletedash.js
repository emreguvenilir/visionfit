// Handle modal open
document.getElementById('upload-btn').addEventListener('click', function() {
    document.getElementById('uploadModal').style.display = 'block';
    document.getElementById('upload-btn').style.display = 'none'; // Hide button
});

// Handle modal close
function closeModal() {
    document.getElementById('uploadModal').style.display = 'none';
    document.getElementById('upload-btn').style.display = 'block'; // Show button again
}

// Close modal if click outside modal content
window.addEventListener('click', function(event) {
    const modal = document.getElementById('uploadModal');
    if (event.target === modal) {
        closeModal();
    }
});

// Show uploaded file name
function showFileName() {
    const fileInput = document.getElementById('fileUpload');
    const fileName = fileInput.files.length > 0 ? fileInput.files[0].name : 'No file chosen';
    document.getElementById('fileName').innerText = fileName;
    document.getElementById('filePreview').style.display = fileInput.files.length > 0 ? 'block' : 'none';
}

// Handle form submission
document.getElementById('liftForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const form = document.getElementById('liftForm');
    const formData = new FormData(form);

    fetch('http://127.0.0.1:5001/analyze_lift', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Analysis Results:', data);

        // Fill table cells
        document.getElementById('avgSpeedCell').innerText = data.avg_speed_mph.toFixed(2) + " MPH";
        document.getElementById('maxSpeedCell').innerText = data.max_speed_mph.toFixed(2) + " MPH";
        if (document.getElementById('fpsCell')) {
            document.getElementById('fpsCell').innerText = data.fps.toFixed(2) + " FPS";
        }

        alert('Lift analysis complete!');
        closeModal();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to analyze lift.');
    });
});
