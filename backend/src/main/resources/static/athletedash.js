    // Open Modal
    document.getElementById('upload-btn').addEventListener('click', function() {
        document.getElementById('uploadModal').style.display = 'block';
    });

    $(window).on('click', function (event) {
        //let $modal = $('#uploadModal');
        if (event.target === $modal[0]) {
            $('#uploadModal').hide();
        }
    });

    // Submit Form
    document.getElementById('liftForm').onsubmit = function(event) {
        event.preventDefault();
        alert('Lift data submitted successfully!');
        closeModal(); // Close the modal after submission
    };