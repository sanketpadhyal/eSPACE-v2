// -------------------- IMPORTS -------------------- //
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");
require("dotenv").config();

// -------------------- INIT -------------------- //
const app = express();
const PORT = process.env.PORT || 3000;

// Replace with your NASA API key
const NASA_API_KEY = "";

// -------------------- MIDDLEWARE -------------------- //
app.use(cors());
app.use(express.json());

// 1️⃣ APOD
app.get("/api/nasa/apod", async (req, res) => {
  try {
    const r = await fetch(
      `https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`,  
    );
    if (!r.ok) throw new Error(`NASA API responded with status ${r.status}`);
    const data = await r.json();

    res.json({
      title: data.title || "NASA Image of the Day",
      explanation: data.explanation || "",
      url: data.url || "", // actual URL, even if video
      hdurl: data.hdurl || "", // optional high-res
      media_type: data.media_type || "image",
      date: data.date || new Date().toISOString().split("T")[0],
    });
  } catch (err) {
    console.error("APOD Error:", err.message);
    res.status(500).json({
      title: "NASA Image of the Day",
      explanation: "Could not fetch today's APOD.",
      url: "assets/mem1.jpg",
      media_type: "image",
      date: new Date().toISOString().split("T")[0],
    });
  }
});

const OPENROUTER_KEY = process.env.OPENROUTER_KEY;  // ADD ENV = OPENROUTER_KEY = ""
const GPT_URL = "https://openrouter.ai/api/v1/chat/completions"; // OpenRouter endpoint

// ---------------- GPT-3.5 Space-Themed eSPACE BOT ---------------- //
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ reply: "Message is empty." });

    const systemPrompt = `
      You are "eSPACE AI BOT", a futuristic AI assistant aboard a spaceship.
      You are friendly, helpful, and knowledgeable about space.
      You can answer questions about space, astronomy, and space missions and many more.
      You are a part of the eSPACE project and you are developed by Sanket Padhyal.
      talk in simple english.
      remember chats previous message
      replace this Hello! How can I assist you today? with Hello! I am eSPACE AI BOT.`;

    const response = await axios.post(
      GPT_URL,
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 500,
        temperature: 0.8,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const reply = response.data.choices[0].message.content.trim();
    res.json({ reply });
  } catch (err) {
    console.error("GPT Error:", err.response?.data || err.message);
    res.status(500).json({ reply: "Failed to fetch GPT response." });
  }
});

// 3️⃣ ISS Current Location (with fallback + day/night)
app.get("/api/nasa/iss", async (req, res) => {
  try {
    let latitude,
      longitude,
      velocity_kmh = null,
      altitude = null,
      timestamp = Date.now();

    // 1. Primary: wheretheiss.at (best source for velocity)
    try {
      const issRes = await axios.get(
        "https://api.wheretheiss.at/v1/satellites/25544",
      );
      latitude = issRes.data.latitude;
      longitude = issRes.data.longitude;
      altitude = issRes.data.altitude;
      timestamp = issRes.data.timestamp * 1000; // convert seconds → ms
      velocity_kmh = issRes.data.velocity; // already km/h
    } catch (e) {
      console.error("❌ wheretheiss.at failed:", e.response?.status, e.message);

      // 2. Fallback: Open Notify (no speed → estimate based on orbit)
      try {
        const fallbackRes = await axios.get(
          "http://api.open-notify.org/iss-now.json",
        );
        if (fallbackRes.data && fallbackRes.data.iss_position) {
          latitude = Number(fallbackRes.data.iss_position.latitude);
          longitude = Number(fallbackRes.data.iss_position.longitude);
          timestamp = fallbackRes.data.timestamp * 1000; // seconds → ms
          altitude = null; // unknown
          // Instead of fixed number, add slight variation for realism
          velocity_kmh = 27600 + Math.random() * 50 - 25;
          console.log("✅ Using Open Notify fallback API with estimated speed");
        } else {
          return res.status(502).json({ error: "Both ISS APIs failed" });
        }
      } catch (fallbackErr) {
        console.error("❌ Open Notify fallback failed:", fallbackErr.message);
        return res.status(502).json({ error: "ISS APIs unavailable" });
      }
    }

    // 3. Day/Night check
    let dayNight = "Unknown";
    try {
      const sunRes = await axios.get(
        `https://api.sunrise-sunset.org/json?lat=${latitude}&lng=${longitude}&formatted=0`,
      );
      if (sunRes.data.status === "OK") {
        const sunrise = new Date(sunRes.data.results.sunrise).getTime();
        const sunset = new Date(sunRes.data.results.sunset).getTime();
        const now = Date.now();
        dayNight = now >= sunrise && now <= sunset ? "Day" : "Night";
      }
    } catch (sunErr) {
      console.warn("⚠️ Sunrise-sunset failed:", sunErr.message);
    }

    // 4. Always respond
    res.json({
      latitude,
      longitude,
      velocity_kmh: velocity_kmh ? Number(velocity_kmh.toFixed(2)) : null,
      altitude_km: altitude,
      timestamp,
      day_night: dayNight,
    });
  } catch (err) {
    console.error("❌ Final ISS handler crash:", err.message);
    res.status(500).json({ error: "Unexpected server error" });
  }
});

// -------------------- STRICT MOON ROVER GALLERY -------------------- //
app.get("/api/nasa/moon-rover", async (req, res) => {
  try {
    let allItems = [];
    let page = 1;

    // Fetch multiple pages to ensure enough images
    while (allItems.length < 300) {
      // more pages for curated selection
      const response = await axios.get(
        `https://images-api.nasa.gov/search?q=moon rover&media_type=image&page=${page}`,
      );

      const items = response.data.collection.items || [];
      if (!items.length) break;

      allItems = allItems.concat(items);
      page++;
    }

    if (!allItems.length) {
      return res.status(404).json({ error: "No Moon Rover images found" });
    }

    // STRICT FILTER: Lunar rover images only
    const curatedRoverImages = allItems.filter((item) => {
      const title = (item.data?.[0]?.title || "").toLowerCase();
      const description = (item.data?.[0]?.description || "").toLowerCase();
      const href = item.links?.[0]?.href || "";

      const isRover = title.includes("rover") || description.includes("rover");
      const isMoonMission =
        title.includes("moon") ||
        description.includes("moon") ||
        title.includes("apollo") ||
        description.includes("apollo") ||
        title.includes("chandrayaan") ||
        description.includes("chandrayaan") ||
        title.includes("artemis") ||
        description.includes("artemis");

      return (
        isRover &&
        isMoonMission &&
        (href.endsWith(".jpg") || href.endsWith(".png"))
      );
    });

    if (!curatedRoverImages.length) {
      return res
        .status(404)
        .json({ error: "No curated Moon Rover images found" });
    }

    // Shuffle and select up to 100 images
    const shuffled = curatedRoverImages.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 100).map((item) => ({
      img_src: item.links?.[0]?.href || null,
      title: item.data?.[0]?.title || "Moon Rover",
      description: item.data?.[0]?.description || "",
      date_created: item.data?.[0]?.date_created || "",
    }));

    res.json(selected);
  } catch (err) {
    console.error("Error fetching Moon Rover gallery:", err.message);
    res.status(500).json({ error: "Failed to fetch Moon Rover gallery" });
  }
});

// -------------------- STRICT MARS CURIOSITY ROVER PHOTOS -------------------- //
app.get("/api/nasa/mars-curiosity", async (req, res) => {
  try {
    const NASA_API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";

    // Example: Fetch latest 200 photos from Curiosity
    const response = await axios.get(
      `https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/photos`,
      {
        params: {
          sol: 1000,
          api_key: NASA_API_KEY,
        },
      },
    );

    const items = response.data.photos || [];

    if (!items.length) {
      return res.status(404).json({ error: "No Curiosity photos found" });
    }

    // Map only the fields you need
    const selected = items.slice(0, 100).map((item) => ({
      img_src: item.img_src,
      rover: item.rover.name,
      camera: item.camera.full_name,
      earth_date: item.earth_date,
      sol: item.sol,
    }));

    res.json(selected);
  } catch (err) {
    console.error("Error fetching Mars Curiosity photos:", err.message);
    res.status(500).json({ error: "Failed to fetch Mars Curiosity photos" });
  }
});

// -------------------- GALAXY + DEEP-SPACE IMAGE GALLERY (JPG + PNG ONLY, SHUFFLED) -------------------- //
app.get("/api/nasa/galaxy-gallery", async (req, res) => {
  try {
    // Fetch galaxy and deep-space images from NASA API
    const response = await axios.get("https://images-api.nasa.gov/search", {
      params: {
        q: "nebula", // can also try "galaxy" or "deep space"
        media_type: "image",
      },
    });

    const items = response.data.collection.items || [];

    if (!items.length) {
      return res.status(404).json({ error: "No galaxy images found" });
    }

    // Filter for JPG and PNG only
    let galleryItems = items
      .filter((item) => item.links?.[0]?.href)
      .filter((item) => {
        const href = item.links[0].href.toLowerCase();
        return href.endsWith(".jpg") || href.endsWith(".png");
      })
      .map((item) => {
        const data = item.data[0];
        return {
          imageUrl: item.links[0].href,
          title: data.title,
          description: data.description,
          date_created: data.date_created,
          nasa_id: data.nasa_id,
        };
      });

    // Shuffle the array
    galleryItems = galleryItems.sort(() => Math.random() - 0.5);

    // Limit to 100 images
    galleryItems = galleryItems.slice(0, 100);

    res.json(galleryItems);
  } catch (err) {
    console.error("Error fetching galaxy gallery:", err.message);
    res.status(500).json({ error: "Failed to fetch galaxy gallery" });
  }
});

// 5️⃣ NASA Live News
app.get("/api/nasa/news", async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`,
    );
    res.json({
      title: response.data.title || "Latest NASA update",
      url: response.data.url,
      date: response.data.date,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch NASA news" });
  }
});

// 6️⃣ NASA Missions (RSS)
app.get("/api/missions", async (req, res) => {
  try {
    const response = await axios.get(
      "https://www.nasa.gov/rss/dyn/breaking_news.rss",
    );
    const parser = new xml2js.Parser();
    parser.parseString(response.data, (err, result) => {
      if (err) {
        console.error("❌ Error parsing NASA RSS:", err.message);
        return res.status(500).json({ error: "Failed to parse NASA missions" });
      }
      const items = result.rss.channel[0].item.slice(0, 5).map((item) => ({
        name: item.title[0],
        desc: item.description[0].replace(/<[^>]+>/g, ""),
        link: item.link[0],
        pubDate: item.pubDate[0],
      }));
      res.json(items);
    });
  } catch (err) {
    console.error("❌ Error fetching NASA missions:", err.message);
    res.status(500).json({ error: "Failed to fetch NASA missions" });
  }
});

// -------------------- NASA Quiz Endpoint -------------------- //
let usedQuizIndices = new Set();
app.get("/api/nasa/quiz", (req, res) => {
  try {
    const quizPath = path.join(__dirname, "quiz.json");
    const rawData = fs.readFileSync(quizPath);
    const quizData = JSON.parse(rawData);

    if (quizData.length === 0) return res.json([]);

    let randomIndex;
    let attempts = 0;
    do {
      randomIndex = Math.floor(Math.random() * quizData.length);
      attempts++;
      if (attempts > 100) break;
    } while (usedQuizIndices.has(randomIndex));

    usedQuizIndices.add(randomIndex);
    const question = quizData[randomIndex];
    if (usedQuizIndices.size >= quizData.length) usedQuizIndices.clear();

    res.json([question]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch quiz from JSON" });
  }
});

// 7️⃣ NASA Gallery (APOD or Mars Rover)
app.get("/api/nasa/gallery", async (req, res) => {
  try {
    // You can choose APOD or Mars Rover. Example: Last 10 APOD images
    const today = new Date();
    const endDate = today.toISOString().split("T")[0];
    const startDate = new Date(today.setDate(today.getDate() - 300)) // last 10 days
      .toISOString()
      .split("T")[0];

    const response = await axios.get(
      `https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}&start_date=${startDate}&end_date=${endDate}`,
    );

    // Filter only images
    const images = response.data
      .filter((item) => item.media_type === "image")
      .map((item) => ({
        title: item.title,
        url: item.url,
        date: item.date,
        explanation: item.explanation,
      }));

    res.json(images);
  } catch (err) {
    console.error("❌ NASA Gallery Error:", err.message);
    res.status(500).json({ error: "Failed to fetch NASA gallery" });
  }
});

// -------------------- START SERVER -------------------- //
app.listen(PORT, () => {
  console.log(`🚀 NASA backend API running on port ${PORT}`);
});
