let macroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0
};

// Default daily goals
const defaultGoals = {
  calories: 2000,
  protein: 50,
  carbs: 275,
  fat: 70
};

const goalSpecificMacros = {
  lose: { calories: 1800, protein: 60, carbs: 200, fat: 60 },
  gain: { calories: 2500, protein: 80, carbs: 350, fat: 80 },
  maintain: { calories: 2000, protein: 60, carbs: 275, fat: 70 },
  build: { calories: 2200, protein: 100, carbs: 250, fat: 70 },
  lean: { calories: 1900, protein: 80, carbs: 150, fat: 65 }
};

let dailyGoals = { ...defaultGoals };

// 🧠 Restore macros + food log from sessionStorage
window.addEventListener("DOMContentLoaded", () => {
  const savedMacros = sessionStorage.getItem("macroTotals");
  const savedGoals = sessionStorage.getItem("dailyGoals");
  const savedLog = sessionStorage.getItem("macroLog");
  const savedHeightFeet = sessionStorage.getItem("height-feet");
  const savedHeightInches = sessionStorage.getItem("height-inches");
  const savedWeight = sessionStorage.getItem("weight");
  const savedMetric = sessionStorage.getItem("metric");
  const savedGoal = sessionStorage.getItem("goal");

  if (savedMacros) macroTotals = JSON.parse(savedMacros);
  if (savedGoals) dailyGoals = JSON.parse(savedGoals);
  if (savedLog) $("#macro-log-body").html(savedLog);
  if (savedHeightFeet) $("#height-feet").val(savedHeightFeet);
  if (savedHeightInches) $("#height-inches").val(savedHeightInches);
  if (savedWeight) $("#weight").val(savedWeight);
  if (savedMetric) $("#metric").val(savedMetric);
  if (savedGoal) $("#goal").val(savedGoal);

  updateMacroTable();
});

// 🧹 Save macros & goals to sessionStorage (so they persist until tab closed)
function saveSessionState() {
  sessionStorage.setItem("macroTotals", JSON.stringify(macroTotals));
  sessionStorage.setItem("dailyGoals", JSON.stringify(dailyGoals));
  sessionStorage.setItem("macroLog", $("#macro-log-body").html());
  
  sessionStorage.setItem("height-feet", $("#height-feet").val()?.trim() || "");
  sessionStorage.setItem("height-inches", $("#height-inches").val()?.trim() || "");
  sessionStorage.setItem("weight", $("#weight").val()?.trim() || "");
  sessionStorage.setItem("metric", $("#metric").val()?.trim() || "");
  sessionStorage.setItem("goal", $("#goal").val()?.trim() || "");
}

async function searchCombined(event) {
  if (event.key !== 'Enter') return;
  const query = document.getElementById("combined-search-bar").value.trim();
  if (!query) return;

  document.getElementById("combined-results").innerHTML = "<p>Loading...</p>";
  try {
    const [calorieData, geminiResult] = await Promise.all([
      fetchCalorieData(query),
      analyzeFoodWithGemini(query, document.getElementById("goal").value, $("#height-feet").val(), $("#height-inches").val(), $("#weight").val(), $("#metric").val() === "kg")
    ]);
    displayCombinedResults(calorieData, [geminiResult]);
  } catch (error) {
    console.error("Error in combined search:", error);
    document.getElementById("combined-results").innerHTML = "<p>Failed to fetch data.</p>";
  }
  document.getElementById("combined-search-bar").value = "";
}

async function fetchCalorieData(query) {
  const url = `https://visionfit.onrender.com/calories_proxy?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) throw new Error(`CalorieNinjas API request failed: ${response.statusText}`);
  return await response.json();
}

async function analyzeFoodWithGemini(foodName, goal, heightFeet, heightInches, weight, metric) {
  const GEMINI_PROXY_URL = "https://visionfit.onrender.com/gemini_proxy";

  const goalText = goal !== "unspecified"
    ? goal.replace(/lose|gain|maintain|build|lean/,
        match => ({
          lose: "losing weight",
          gain: "gaining weight",
          maintain: "maintaining weight",
          build: "building muscle",
          lean: "getting leaner"
        }[match])
      )
    : "an unspecified fitness goal";

  const prompt = `You are a professional nutritionist. Provide the following for the food item "${foodName}":
  1. A sentence describing its main nutritional benefit or downside.
  2. A sentence evaluating its suitability for ${goalText}.
  3. A short suggestion on the next meal to complement ${foodName}.

  Athlete Information:
  - Height: ${heightFeet} ft ${heightInches} in
  - Weight: ${weight} ${metric ? "kg" : "lbs"}`;
  
  try {
    const response = await fetch(GEMINI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) throw new Error(`Gemini API request failed: ${response.statusText}`);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
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

  updateMacroTable();
  addFoodLogEntry(item);
  saveSessionState(); // 🔹 persist after every addition
}

function updateMacroTable() {
  $("#calories-consumed").text(macroTotals.calories.toFixed(1));
  $("#protein-consumed").text(macroTotals.protein.toFixed(1));
  $("#carbs-consumed").text(macroTotals.carbs.toFixed(1));
  $("#fat-consumed").text(macroTotals.fat.toFixed(1));

  $("#calories-goal").text(dailyGoals.calories);
  $("#protein-goal").text(dailyGoals.protein);
  $("#carbs-goal").text(dailyGoals.carbs);
  $("#fat-goal").text(dailyGoals.fat);

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

  dailyGoals = goalSpecificMacros[goal] ? { ...goalSpecificMacros[goal] } : { ...defaultGoals };
  updateMacroTable();
  saveSessionState(); // 🔹 persist goal change

  $(".search-container").show();

  $("#stored-weight").text($("#weight").val()?.trim() + " " + $("#metric").val()?.trim() || "N/A");
  const heightFeet = $("#height-feet").val()?.trim() || "N/A";
  const heightInches = $("#height-inches").val()?.trim() || "N/A";
  const height = (heightFeet !== "N/A" ? heightFeet + "'" : "") + (heightInches !== "N/A" ? heightInches + '"' : "");
  $("#stored-height").text(height || "N/A");
  $("#stored-goal").text(goal.charAt(0).toUpperCase() + goal.slice(1) || "N/A");
}

updateMacroTable();
document.getElementById("combined-search-bar").addEventListener("keyup", searchCombined);