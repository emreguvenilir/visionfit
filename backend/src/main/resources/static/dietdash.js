const CALORIE_NINJAS_API_KEY = "rYzH1pB46F9BsHel1beq4w==2dMCoBMLix22FUBM";
const GEMINI_API_KEY = "AIzaSyChBpvxw6IeA8PgfIgHzR-6573XmHf3rmk";

let macroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0
};

// Define default daily goals (matching HTML)
const defaultGoals = {
  calories: 2000,
  protein: 50,
  carbs: 275,
  fat: 70
};

// Define goal-specific macro goals
const goalSpecificMacros = {
  lose: { calories: 1800, protein: 60, carbs: 200, fat: 60 },
  gain: { calories: 2500, protein: 80, carbs: 350, fat: 80 },
  maintain: { calories: 2000, protein: 60, carbs: 275, fat: 70 },
  build: { calories: 2200, protein: 100, carbs: 250, fat: 70 },
  lean: { calories: 1900, protein: 80, carbs: 150, fat: 65 }
};

// Initialize dailyGoals with default values
let dailyGoals = { ...defaultGoals };

async function searchCombined(event) {
  if (event.key !== 'Enter') return;
  const query = document.getElementById("combined-search-bar").value.trim();
  if (!query) return;

  document.getElementById("combined-results").innerHTML = "<p>Loading...</p>";
  try {
    const [calorieData, geminiResult] = await Promise.all([
      fetchCalorieData(query),
      analyzeFoodWithGemini(query, document.getElementById("goal").value || "unspecified")
    ]);
    displayCombinedResults(calorieData, [geminiResult]);
  } catch (error) {
    console.error("Error in combined search:", error);
    document.getElementById("combined-results").innerHTML = "<p>Failed to fetch data.</p>";
  }
  document.getElementById("combined-search-bar").value = "";
}

async function fetchCalorieData(query) {
  const url = `https://api.calorieninjas.com/v1/nutrition?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "X-Api-Key": CALORIE_NINJAS_API_KEY, "Content-Type": "application/json" }
  });
  if (!response.ok) throw new Error(`CalorieNinjas API request failed: ${response.statusText}`);
  return await response.json();
}

async function analyzeFoodWithGemini(foodName, goal) {
  const goalText = goal !== "unspecified" ? goal.replace(/lose|gain|maintain|build|lean/, 
    match => ({
      lose: "losing weight",
      gain: "gaining weight",
      maintain: "maintaining weight",
      build: "building muscle",
      lean: "getting leaner"
    }[match])) : "an unspecified fitness goal";

  const prompt = `Provide the following about ${foodName}:
  1. A short sentence describing its main nutritional benefit.
  2. A sentence evaluating its suitability for ${goalText}.
  3. A simple recipe that includes ${foodName} with basic ingredients and steps.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
    const text = data.candidates[0].content.parts[0].text;
    const lines = text.split('\n').filter(line => line.trim());
    return {
      foodName,
      benefit: lines[0] || "No benefit found.",
      suitability: lines[1] || "No suitability analysis.",
      recipe: lines.slice(2).join('<br>') || "No recipe provided."
    };
  } catch (error) {
    console.error(`Error analyzing ${foodName} with Gemini:`, error);
    return {
      foodName,
      benefit: "Unable to analyze nutritional benefits.",
      suitability: `Unable to evaluate suitability for ${goalText}.`,
      recipe: "No recipe found."
    };
  }
}

function addMacrosToTracker(item) {
  macroTotals.calories += parseFloat(item.calories) || 0;
  macroTotals.protein += parseFloat(item.protein_g) || 0;
  macroTotals.carbs += parseFloat(item.carbohydrates_total_g) || 0;
  macroTotals.fat += parseFloat(item.fat_total_g) || 0;

  console.log("Macros added:", macroTotals);
  updateMacroTable();
  addFoodLogEntry(item);
}

function updateMacroTable() {
  console.log("Updating macro table with dailyGoals:", dailyGoals);

  // Update consumed values
  $("#calories-consumed").text(macroTotals.calories.toFixed(1));
  $("#protein-consumed").text(macroTotals.protein.toFixed(1));
  $("#carbs-consumed").text(macroTotals.carbs.toFixed(1));
  $("#fat-consumed").text(macroTotals.fat.toFixed(1));

  // Update daily goal values
  $("#calories-goal").text(dailyGoals.calories);
  $("#protein-goal").text(dailyGoals.protein);
  $("#carbs-goal").text(dailyGoals.carbs);
  $("#fat-goal").text(dailyGoals.fat);

  // Update percentage completion
  $("#calories-percent").text(((macroTotals.calories / dailyGoals.calories) * 100).toFixed(1) + "%");
  $("#protein-percent").text(((macroTotals.protein / dailyGoals.protein) * 100).toFixed(1) + "%");
  $("#carbs-percent").text(((macroTotals.carbs / dailyGoals.carbs) * 100).toFixed(1) + "%");
  $("#fat-percent").text(((macroTotals.fat / dailyGoals.fat) * 100).toFixed(1) + "%");

}


function addFoodLogEntry(item) {
  const logEntry = `
    <tr>
      <td>${item.name}</td>
      <td>${item.calories} kcal</td>
      <td>${item.protein_g} g</td>
      <td>${item.carbohydrates_total_g} g</td>
      <td>${item.fat_total_g} g</td>
    </tr>
  `;
  $("#macro-log-body").append(logEntry);
}

function displayCombinedResults(calorieData, geminiResults) {
  const resultsDiv = document.getElementById("combined-results");
  resultsDiv.innerHTML = "";

  if (calorieData.items && calorieData.items.length > 0) {
    calorieData.items.forEach((item, index) => {
      const geminiResult = geminiResults[index] || {
        foodName: item.name,
        benefit: "No analysis available.",
        suitability: "No suitability analysis.",
        recipe: "No recipe provided."
      };

      const div = document.createElement("div");
      div.classList.add("food-result");
      div.style.marginBottom = "15px";
      div.style.padding = "12px";
      div.style.border = "1px solid #ccc";
      div.style.borderRadius = "6px";
      div.style.backgroundColor = "#f9f9f9";
      div.style.color = "#000";
      div.style.width = "100%";
      div.style.boxSizing = "border-box";


      div.innerHTML = `
        <strong>${item.name}</strong>
        <div class="nutrition" style="margin-top:8px; margin-bottom:8px;">
          <strong>Nutritional Breakdown:</strong><br>
          Calories: ${item.calories} kcal<br>
          Protein: ${item.protein_g} g<br>
          Carbs: ${item.carbohydrates_total_g} g<br>
          Fat: ${item.fat_total_g} g
        </div>
        <div class="analysis" style="margin-bottom:8px;">
          <em><strong>Nutritional Benefit:</strong> ${geminiResult.benefit}</em><br>
          <em><strong>Suitability:</strong> ${geminiResult.suitability}</em><br>
          <em><strong>Recipe:</strong><br>${geminiResult.recipe}</em>
        </div>
        <button class="add-macros-btn" style="
          padding: 6px 12px;
          background-color: #2473ff;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
        " onclick='addMacrosToTracker(${JSON.stringify(item)})'>Add to Tracker</button>
      `;

      resultsDiv.appendChild(div);
    });
  } else {
    resultsDiv.innerHTML = "<p>No food items found.</p>";
  }
}


function submitGoal() {
  const goal = $("#goal").val()?.trim();

  if (!goal) {
    alert("Please select a fitness goal before proceeding.");
    return;
  }

  console.log("Goal submitted:", goal);

  // Update dailyGoals based on selected goal
  window.dailyGoals = goalSpecificMacros[goal] ? { ...goalSpecificMacros[goal] } : { ...defaultGoals };
  console.log("Updated dailyGoals:", window.dailyGoals);

  // Immediately update the macro table
  updateMacroTable();

  // Show the search container
  $(".search-container").show();

  // Update stored info section so user can see their goal using jquery
  $("#stored-weight").text($("#weight").val()?.trim() + " " + $("#metric").val()?.trim() || "N/A");
  //height is made up of height-feet and height-inches
  const heightFeet = $("#height-feet").val()?.trim() || "N/A";
  const heightInches = $("#height-inches").val()?.trim() || "N/A";
  const height = (heightFeet !== "N/A" ? heightFeet + "'" : "") + (heightInches !== "N/A" ? heightInches + '"' : "");
  $("#stored-height").text(height || "N/A");
  $("#stored-goal").text(goal.charAt(0).toUpperCase() + goal.slice(1) || "N/A");

  
}


// Initialize macro table with default goals on page load
console.log("Page loaded, initializing macro table with default goals");
updateMacroTable();

document.getElementById("combined-search-bar").addEventListener("keyup", searchCombined);