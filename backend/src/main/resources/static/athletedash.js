    // Open Modal
    document.getElementById('upload-btn').addEventListener('click', function() {
        document.getElementById('uploadModal').style.display = 'block';
    });

    // Close Modal
    function closeModal() {
        document.getElementById('uploadModal').style.display = 'none';
    }

    // Close Modal if user clicks outside content
    window.onclick = function(event) {
        let modal = document.getElementById('uploadModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Submit Form
    document.getElementById('liftForm').onsubmit = function(event) {
        event.preventDefault();
        alert('Lift data submitted successfully!');
        closeModal(); // Close the modal after submission
    };