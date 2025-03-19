
//<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>

$(document).ready(function() {
    console.log("jQuery is loaded and document is ready."); // Check if jQuery is working

    $("#indexSignIn").click(function(event) {
        event.preventDefault();  // Prevents default anchor click behavior
        console.log("Test reached");  // Debugging log
        window.location.href = "/athlete_dashboard.html";  // Uncomment when ready to redirect
    });
});
