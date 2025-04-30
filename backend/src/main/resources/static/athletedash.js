let liftCounter = 1; // Start from 1 for sidebar lift labels

// Handle modal open
document.getElementById('upload-btn').addEventListener('click', function() {
    document.getElementById('uploadModal').style.display = 'block';
    document.getElementById('upload-btn').style.display = 'none';
});

// Handle modal close
function closeModal() {
    document.getElementById('uploadModal').style.display = 'none';
    document.getElementById('upload-btn').style.display = 'block';
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

        const tbody = document.querySelector('.table-container tbody');

        // Remove placeholder row if it's the first analysis
        const firstRow = tbody.querySelector('tr');
        if (firstRow && firstRow.innerText.includes('...') && liftCounter === 1) {
            tbody.removeChild(firstRow);
        }

        // Add new row of analysis data
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td><div class="cell">${data.avg_speed_mph.toFixed(2)} MPH</div></td>
            <td><div class="cell">${data.max_speed_mph.toFixed(2)} MPH</div></td>
            <td><div class="cell">...</div></td>
            <td><div class="cell">...</div></td>
            <td><div class="cell">...</div></td>
            <td><div class="cell">...</div></td>
            <td><div class="cell">...</div></td>
        `;
        tbody.appendChild(newRow);

        // Add entry to sidebar
        const sidebar = document.querySelector('.sidebar');
        const liftLink = document.createElement('a');
        liftLink.innerHTML = `<div class="cell">Lift_${liftCounter}</div>`;
        sidebar.appendChild(liftLink);
        liftCounter++;

        alert('Lift analysis complete!');
        closeModal();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to analyze lift.');
    });
});
