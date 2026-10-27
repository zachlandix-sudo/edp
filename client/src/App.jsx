import { useEffect, useState } from "react";
import ChatWidget from "./ChatWidget.jsx";

const API_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const categories = [
  { name: "Nature & Waterfalls", icon: "🌿", category: "Nature" },
  { name: "Beaches & Islands", icon: "🏝️", category: "Beach" },
  { name: "Culture & Heritage", icon: "🏛️", category: "Cultural" },
  { name: "Adventure", icon: "🥾", category: "Adventure" },
];

const heroImage =
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2000&q=85";

function getSpotId(spot) {
  return spot?._id || spot?.id;
}

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="navbar">
      <a className="brand" href="#home" aria-label="Maasin Tour Guide home">
        <span className="brand-icon">M</span>
        <span>
          <strong>MAASIN</strong>
          <small>TOUR GUIDE</small>
        </span>
      </a>

      <button
        className="menu-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle navigation"
      >
        {menuOpen ? "✕" : "☰"}
      </button>

      <nav className={menuOpen ? "nav-links nav-open" : "nav-links"}>
        <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
        <a href="#destinations" onClick={() => setMenuOpen(false)}>Destinations</a>
        <a href="#categories" onClick={() => setMenuOpen(false)}>Categories</a>
        <a href="#ai-guide" onClick={() => setMenuOpen(false)}>AI Tour Guide</a>
        <a href="#about" onClick={() => setMenuOpen(false)}>About Maasin</a>
        <a className="nav-cta" href="#destinations" onClick={() => setMenuOpen(false)}>
          Explore places ↗
        </a>
      </nav>
    </header>
  );
}

function DestinationCard({ spot }) {
  const id = getSpotId(spot);
  const image =
    spot.imageUrl ||
    spot.image ||
    "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=80";

  return (
    <article className="destination-card">
      <a
        className="destination-image"
        href={id ? `/spots/${id}` : "#destinations"}
        aria-label={`View ${spot.name}`}
      >
        <img src={image} alt={spot.name} loading="lazy" />
        <span className="image-category">
          {spot.category || "Destination"}
        </span>
      </a>

      <div className="destination-info">
        <p className="destination-location">📍 {spot.address || "Maasin City, Southern Leyte"}</p>
        <h3>{spot.name || "Untitled destination"}</h3>
        <p className="destination-description">
          {spot.description || "Discover this beautiful destination in Southern Leyte."}
        </p>
        <div className="destination-bottom">
          <span>
            Entrance fee: <strong>{spot.entranceFee != null ? `₱${spot.entranceFee}` : "Check locally"}</strong>
          </span>
          {id ? (
            <a className="card-arrow" href={`/spots/${id}`} aria-label={`Explore ${spot.name}`}>
              ↗
            </a>
          ) : (
            <span className="card-arrow">↗</span>
          )}
        </div>
      </div>
    </article>
  );
}

function App() {
  const [spots, setSpots] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [travelers, setTravelers] = useState(2);
  const [budget, setBudget] = useState(1000);
  const [pace, setPace] = useState("moderate");
  const [interests, setInterests] = useState([]);
  const [itinerary, setItinerary] = useState(null);
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const [itineraryError, setItineraryError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadSpots() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_URL}/spots`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`The server returned status ${response.status}.`);
        }

        const result = await response.json();
        const records = Array.isArray(result)
          ? result
          : result.spots || result.data || result.results || [];

        setSpots(records);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to load destinations:", err);
          setError(
            err.message ||
            "We couldn't load destinations from the server."
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadSpots();
    return () => controller.abort();
  }, []);

  async function generateItinerary(event) {
    event.preventDefault();

    setItineraryLoading(true);
    setItineraryError("");
    setItinerary(null);

    try {
      const response = await fetch(`${API_URL}/itineraries/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          travelers: Number(travelers),
          startingBudgetPerPerson: Number(budget),
          pace,
          interests,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to generate itinerary.");
      }

      setItinerary(data.itinerary);
    } catch (error) {
      setItineraryError(error.message || "Something went wrong.");
    } finally {
      setItineraryLoading(false);
    }
  }

  const filteredSpots = spots.filter((spot) => {
    const text = `${spot.name || ""} ${spot.description || ""} ${spot.address || ""}`
      .toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());
    const matchesCategory =
      !category ||
      String(spot.category || "").toLowerCase() === category.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <Navbar />

      <main>
        <section
          className="hero"
          id="home"
          style={{ "--hero-image": `url("${heroImage}")` }}
        >
          <div className="hero-content">
            <span className="eyebrow hero-eyebrow">
              SOUTHERN LEYTE, PHILIPPINES
            </span>
            <h1>
              Find your next
              <br />
              <em>beautiful escape.</em>
            </h1>
            <p>
              Discover hidden gems, breathtaking landscapes, and unforgettable
              experiences in Maasin City.
            </p>

            <a className="primary-button" href="#destinations">
              Discover destinations <span>↗</span>
            </a>

            <div className="hero-note">
              <span className="hero-note-icon">✦</span>
              <span>Local places. Real experiences. Lasting memories.</span>
            </div>
          </div>

          <div className="hero-caption">
            <span>01 / EXPLORE THE UNEXPECTED</span>
            <span>MAASIN CITY · SOUTHERN LEYTE</span>
          </div>
        </section>

        <section className="intro-strip">
          <div>
            <span className="eyebrow">YOUR JOURNEY STARTS HERE</span>
            <h2>There's more to discover.</h2>
          </div>
          <p>
            From peaceful coastlines to cultural landmarks, find places worth
            experiencing at your own pace.
          </p>
        </section>

        <section className="categories-section section-wrap" id="categories">
          <div className="section-heading">
            <div>
              <span className="eyebrow">EXPLORE YOUR WAY</span>
              <h2>What are you looking for?</h2>
            </div>
            <a href="#destinations" className="text-link">
              All destinations ↗
            </a>
          </div>

          <div className="category-grid">
            {categories.map((item) => (
              <button
                className={`category-card ${category === item.category ? "category-active" : ""}`}
                key={item.name}
                onClick={() =>
                  setCategory((current) =>
                    current === item.category ? "" : item.category
                  )
                }
              >
                <span className="category-icon">{item.icon}</span>
                <span>
                  <strong>{item.name}</strong>
                  <small>Explore destinations ↗</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="ai-guide-section section-wrap" id="ai-guide">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR PERSONAL TRAVEL PLANNER</span>
              <h2>Meet your AI Tour Guide.</h2>
              <p className="section-subtitle">
                Create a one-day Maasin City itinerary based on your budget,
                group size, and interests.
              </p>
            </div>
          </div>

          <form className="ai-guide-form" onSubmit={generateItinerary}>
            <label>
              Number of travelers
              <input
                type="number"
                min="1"
                max="50"
                value={travelers}
                onChange={(event) => setTravelers(event.target.value)}
                required
              />
            </label>

            <label>
              Budget per person (₱)
              <input
                type="number"
                min="0"
                max="1000000"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                required
              />
            </label>

            <label>
              Travel pace
              <select
                value={pace}
                onChange={(event) => setPace(event.target.value)}
              >
                <option value="relaxed">Relaxed</option>
                <option value="moderate">Moderate</option>
                <option value="packed">Packed</option>
              </select>
            </label>

            <fieldset className="interest-options">
              <legend>What are you interested in?</legend>
              {["Nature", "Beach", "Cultural", "Adventure"].map((interest) => (
                <label key={interest} className="interest-option">
                  <input
                    type="checkbox"
                    checked={interests.includes(interest)}
                    onChange={(event) => {
                      setInterests((current) =>
                        event.target.checked
                          ? [...current, interest]
                          : current.filter((item) => item !== interest)
                      );
                    }}
                  />
                  {interest}
                </label>
              ))}
            </fieldset>

            <button
              className="primary-button"
              type="submit"
              disabled={itineraryLoading}
            >
              {itineraryLoading
                ? "Creating your itinerary..."
                : "Generate My Itinerary ↗"}
            </button>
          </form>

          {itineraryError && (
            <div className="status-message error-message" role="alert">
              <h3>Couldn't generate your itinerary</h3>
              <p>{itineraryError}</p>
            </div>
          )}

          {itinerary && (
            <div className="ai-itinerary-results" aria-live="polite">
              <span className="eyebrow">YOUR PERSONALIZED PLAN</span>
              <h3>{itinerary.title}</h3>
              <p>{itinerary.summary}</p>

              <div className="ai-budget-summary">
                <p>
                  Estimated group cost:{" "}
                  <strong>
                    ₱{Number(itinerary.budget?.totalGroupCost || 0).toLocaleString()}
                  </strong>
                </p>
                <p>
                  Estimated cost per person:{" "}
                  <strong>
                    ₱{Number(itinerary.budget?.totalPerPerson || 0).toLocaleString()}
                  </strong>
                </p>
              </div>

              <div className="ai-stop-list">
                {itinerary.stops?.map((stop, index) => (
                  <article className="ai-stop-card" key={`${stop.name}-${index}`}>
                    <span className="ai-stop-number">{index + 1}</span>
                    <div>
                      <h4>{stop.name}</h4>
                      <p>
                        {stop.startTime} – {stop.endTime}
                      </p>
                      <p>{stop.activity}</p>
                      <small>
                        Entrance: ₱{Number(stop.estimatedEntranceFeePerPerson || 0).toLocaleString()} per person
                      </small>
                    </div>
                  </article>
                ))}
              </div>

              {itinerary.travelTips?.length > 0 && (
                <div className="ai-travel-tips">
                  <h4>Travel tips</h4>
                  <ul>
                    {itinerary.travelTips.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="destinations-section" id="destinations">
          <div className="section-wrap">
            <div className="section-heading">
              <div>
                <span className="eyebrow">MAASIN AND BEYOND</span>
                <h2>Explore destinations.</h2>
                <p className="section-subtitle">
                  Find a place that makes you want to stay a little longer.
                </p>
              </div>
              <span className="spot-count">
                {spots.length} {spots.length === 1 ? "PLACE" : "PLACES"} FOUND
              </span>
            </div>

            <div className="search-panel">
              <span className="search-icon">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search destinations, places, or experiences..."
                aria-label="Search destinations"
              />
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                <option value="Nature">Nature</option>
                <option value="Beach">Beach</option>
                <option value="Cultural">Cultural</option>
                <option value="Adventure">Adventure</option>
              </select>
            </div>

            {loading ? (
              <div className="status-message">
                <span className="loader" />
                <p>Discovering places for you...</p>
              </div>
            ) : error ? (
              <div className="status-message error-message">
                <span>⚠</span>
                <h3>Destinations aren't available yet.</h3>
                <p>{error}</p>
                <button className="secondary-button" onClick={() => window.location.reload()}>
                  Try again
                </button>
              </div>
            ) : filteredSpots.length ? (
              <div className="destination-grid">
                {filteredSpots.map((spot, index) => (
                  <DestinationCard
                    key={getSpotId(spot) || spot.slug || `${spot.name}-${index}`}
                    spot={spot}
                  />
                ))}
              </div>
            ) : (
              <div className="status-message">
                <span>⌕</span>
                <h3>No destinations found.</h3>
                <p>
                  {spots.length
                    ? "Try another search or choose a different category."
                    : "Your destinations will appear here when records are available in your database."}
                </p>
                {(search || category) && (
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setSearch("");
                      setCategory("");
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="about-section" id="about">
          <div className="about-image">
            <img
              src="https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1200&q=85"
              alt="Tropical coastline"
              loading="lazy"
            />
            <span className="image-stamp">YOUR LOCAL<br />TRAVEL COMPANION</span>
          </div>
          <div className="about-content">
            <span className="eyebrow">A LITTLE PLACE WITH A LOT TO OFFER</span>
            <h2>Get to know<br /><em>Maasin City.</em></h2>
            <p>
              Nestled in Southern Leyte, Maasin City invites you to slow down,
              meet the community, discover local culture, and explore the
              natural beauty of the region.
            </p>
            <p>
              Let this guide help you find places to visit, experiences to
              remember, and new reasons to explore.
            </p>
            <a className="primary-button" href="#destinations">
              Start exploring <span>↗</span>
            </a>
          </div>
        </section>

        <section className="closing-cta">
          <span className="eyebrow">YOUR NEXT ADVENTURE AWAITS</span>
          <h2>Make room for wonder.</h2>
          <p>Start exploring Maasin City, one destination at a time.</p>
          <a className="light-button" href="#destinations">Find your destination ↗</a>
        </section>
      </main>

      <footer className="footer">
        <a className="brand footer-brand" href="#home">
          <span className="brand-icon">M</span>
          <span><strong>MAASIN</strong><small>TOUR GUIDE</small></span>
        </a>
        <p>Discover Maasin. Experience Southern Leyte.</p>
        <a href="#home">Back to top ↑</a>
        <small className="copyright">© {new Date().getFullYear()} Maasin Tour Guide</small>
      </footer>

      <ChatWidget />
    </>
  );
}

export default App;
