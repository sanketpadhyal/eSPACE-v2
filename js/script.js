function toggleMenu() {
  document.querySelector("nav ul.mobile").classList.toggle("show");
}

window.addEventListener("load", () => {
  document.body.style.backgroundSize = "100% auto";
});

window.addEventListener("scroll", () => {
  let zoom = 100 + window.scrollY / 50;
  document.body.style.backgroundSize = zoom + "% auto";
});

window.onbeforeunload = () => {
  window.scrollTo(0, 0);
};

function toggleSearchButton() {
  const input = document.getElementById("cityInput");
  const btn = document.getElementById("searchBtn");
  btn.style.display = input.value.trim() ? "block" : "none";
}

async function searchCity() {
  const city = document.getElementById("cityInput").value.trim();
  if (!city) return;

  try {
    // Geocoding API to convert city -> lat/lon
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?city=${city}&format=json&limit=1`);
    const geoData = await geoRes.json();
    if (!geoData.length) {
      alert("City not found ❌");
      return;
    }
    const lat = geoData[0].lat;
    const lon = geoData[0].lon;

    // Call your forecast loader
    loadForecast(lat, lon);
  } catch (err) {
    console.error(err);
    alert("Error fetching city forecast ❌");
  }
}

//  AI CHAT SCRIPTS //
(function(){
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const closeBtn = document.getElementById('closeChat');
    const aiChat = document.getElementById('aiChat');

    function appendMessage(text, cls='bot'){
      const d = document.createElement('div');
      d.className = 'message ' + (cls==='user' ? 'user' : 'bot');
      d.textContent = text;
      chatMessages.appendChild(d);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function botReply(userText){
      // simple rule-based replies
      const t = userText.toLowerCase();
      if(/mercury|venus|earth|mars|jupiter|saturn|uranus|neptune/.test(t)){
        const planet = t.match(/mercury|venus|earth|mars|jupiter|saturn|uranus|neptune/)[0];
        const map = {
          mercury: 'Mercury: smallest, closest to the Sun, extreme temperatures.',
          venus: 'Venus: very hot, thick CO₂ atmosphere, rotates slowly backwards.',
          earth: 'Earth: our home, liquid water, one moon, supports life.',
          mars: 'Mars: the Red Planet, polar caps, largest volcano Olympus Mons.',
          jupiter: 'Jupiter: largest planet, Great Red Spot, many moons e.g., Ganymede.',
          saturn: 'Saturn: famous rings, gas giant, moon Titan is notable.',
          uranus: 'Uranus: ice giant, tilted on its side, faint rings.',
          neptune: 'Neptune: deep blue ice giant, very strong winds.'
        };
        return map[planet] || "Here's what I know about " + planet + ".";
      }