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
}

function updateMacroTable() {
  console.log("Updating macro table with dailyGoals:", dailyGoals);

  // Update consumed values
  document.getElementById("calories-consumed").textContent = macroTotals.calories.toFixed(1);
  document.getElementById("protein-consumed").textContent = macroTotals.protein.toFixed(1);
  document.getElementById("carbs-consumed").textContent = macroTotals.carbs.toFixed(1);
  document.getElementById("fat-consumed").textContent = macroTotals.fat.toFixed(1);

  // Update daily goal values
  document.getElementById("calories-goal").textContent = dailyGoals.calories;
  document.getElementById("protein-goal").textContent = dailyGoals.protein;
  document.getElementById("carbs-goal").textContent = dailyGoals.carbs;
  document.getElementById("fat-goal").textContent = dailyGoals.fat;

  // Update percentage completion
  document.getElementById("calories-percent").textContent = ((macroTotals.calories / dailyGoals.calories) * 100).toFixed(1) + "%";
  document.getElementById("protein-percent").textContent = ((macroTotals.protein / dailyGoals.protein) * 100).toFixed(1) + "%";
  document.getElementById("carbs-percent").textContent = ((macroTotals.carbs / dailyGoals.carbs) * 100).toFixed(1) + "%";
  document.getElementById("fat-percent").textContent = ((macroTotals.fat / dailyGoals.fat) * 100).toFixed(1) + "%";
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
      div.innerHTML = `
        <strong>${item.name}</strong>
        <div class="nutrition">
          <strong>Nutritional Breakdown:</strong><br>
          Calories: ${item.calories} kcal<br>
          Protein: ${item.protein_g} g<br>
          Carbs: ${item.carbohydrates_total_g} g<br>
          Fat: ${item.fat_total_g} g
        </div>
        <div class="analysis">
          <em><strong>Nutritional Benefit:</strong> ${geminiResult.benefit}</em><br>
          <em><strong>Suitability:</strong> ${geminiResult.suitability}</em><br>
          <em><strong>Recipe:</strong><br>${geminiResult.recipe}</em>
        </div>
        <button class="add-macros-btn" onclick='addMacrosToTracker(${JSON.stringify(item)})'>Add to Tracker</button>
      `;
      resultsDiv.appendChild(div);
    });
  } else {
    resultsDiv.innerHTML = "<p>No food items found.</p>";
  }
}

function submitGoal() {
  const goalInput = document.getElementById("goal");
  const goal = goalInput.value.trim();
  if (!goal) {
    alert("Please select a fitness goal before proceeding.");
    return;
  }

  console.log("Goal submitted:", goal);

  // Update dailyGoals based on selected goal
  dailyGoals = { ...goalSpecificMacros[goal] } || { ...defaultGoals };
  console.log("Updated dailyGoals:", dailyGoals);

  // Immediately update the macro table
  updateMacroTable();

  // Show the search container
  document.querySelector('.search-container').style.display = 'block';
}

// Initialize macro table with default goals on page load
console.log("Page loaded, initializing macro table with default goals");
updateMacroTable();

document.getElementById("combined-search-bar").addEventListener("keyup", searchCombined);