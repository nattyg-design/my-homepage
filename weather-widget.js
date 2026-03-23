// Weather Widget Configuration
const WEATHER_CONFIG = {
  // Default location if geolocation fails
  defaultLat: 47.6062,
  defaultLon: -122.3321,
  defaultCity: 'Seattle',

  // Update interval (milliseconds)
  updateInterval: 600000, // 10 minutes

  // Temperature unit: 'celsius' or 'fahrenheit'
  temperatureUnit: 'fahrenheit',

  // Wind speed unit: 'kmh', 'mph', 'ms', 'kn'
  windSpeedUnit: 'mph'
};

// Weather condition mappings
const WEATHER_CONDITIONS = {
  0: { icon: '☀️', description: 'Clear sky' },
  1: { icon: '🌤️', description: 'Mainly clear' },
  2: { icon: '⛅', description: 'Partly cloudy' },
  3: { icon: '☁️', description: 'Overcast' },
  45: { icon: '🌫️', description: 'Foggy' },
  48: { icon: '🌫️', description: 'Depositing rime fog' },
  51: { icon: '🌦️', description: 'Light drizzle' },
  53: { icon: '🌦️', description: 'Moderate drizzle' },
  55: { icon: '🌦️', description: 'Dense drizzle' },
  61: { icon: '🌧️', description: 'Slight rain' },
  63: { icon: '🌧️', description: 'Moderate rain' },
  65: { icon: '🌧️', description: 'Heavy rain' },
  71: { icon: '🌨️', description: 'Slight snow' },
  73: { icon: '🌨️', description: 'Moderate snow' },
  75: { icon: '🌨️', description: 'Heavy snow' },
  77: { icon: '🌨️', description: 'Snow grains' },
  80: { icon: '🌦️', description: 'Slight rain showers' },
  81: { icon: '🌦️', description: 'Moderate rain showers' },
  82: { icon: '🌧️', description: 'Violent rain showers' },
  85: { icon: '🌨️', description: 'Slight snow showers' },
  86: { icon: '🌨️', description: 'Heavy snow showers' },
  95: { icon: '⛈️', description: 'Thunderstorm' },
  96: { icon: '⛈️', description: 'Thunderstorm with slight hail' },
  99: { icon: '⛈️', description: 'Thunderstorm with heavy hail' }
};

// Weather widget settings manager
class WeatherWidgetConfig {
  constructor() {
    this.loadSettings();
  }

  loadSettings() {
    const saved = localStorage.getItem('weatherWidgetSettings');
    if (saved) {
      Object.assign(WEATHER_CONFIG, JSON.parse(saved));
    }
  }

  saveSettings(settings) {
    localStorage.setItem('weatherWidgetSettings', JSON.stringify(settings));
  }

  toggleUnit() {
    WEATHER_CONFIG.temperatureUnit =
      WEATHER_CONFIG.temperatureUnit === 'celsius' ? 'fahrenheit' : 'celsius';
    this.saveSettings(WEATHER_CONFIG);
    weatherWidget.updateWeather();
  }
}

// Main weather widget class
class WeatherWidget {
  constructor() {
    this.container = document.getElementById('weather-widget');
    this.location = null;
    this.updateTimer = null;
  }

  async init() {
    try {
      // Try to get user's location
      await this.getUserLocation();

      // Fetch and display weather
      await this.updateWeather();

      // Set up auto-update
      this.startAutoUpdate();
    } catch (error) {
      console.error('Weather widget initialization failed:', error);
      this.showError('Unable to load weather data');
    }
  }

  async getUserLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        this.location = {
          lat: WEATHER_CONFIG.defaultLat,
          lon: WEATHER_CONFIG.defaultLon,
          city: WEATHER_CONFIG.defaultCity
        };
        resolve();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          this.location = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            city: await this.getCityName(position.coords.latitude, position.coords.longitude)
          };
          resolve();
        },
        (error) => {
          console.warn('Geolocation failed, using default location:', error);
          this.location = {
            lat: WEATHER_CONFIG.defaultLat,
            lon: WEATHER_CONFIG.defaultLon,
            city: WEATHER_CONFIG.defaultCity
          };
          resolve();
        }
      );
    });
  }

  async getCityName(lat, lon) {
    try {
      // Use reverse geocoding API (optional)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
      );
      const data = await response.json();
      return data.address?.city || data.address?.town || data.address?.village || 'Unknown Location';
    } catch (error) {
      return 'Unknown Location';
    }
  }

  async fetchWeatherData() {
    const { lat, lon } = this.location;
    const url =
      `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${lat}&longitude=${lon}` +
      `&current_weather=true` +
      `&hourly=temperature_2m,relativehumidity_2m,precipitation_probability` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&temperature_unit=${WEATHER_CONFIG.temperatureUnit}` +
      `&windspeed_unit=${WEATHER_CONFIG.windSpeedUnit}` +
      `&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Weather API request failed');
    }

    return await response.json();
  }

  async fetchForecastData() {
    const { lat, lon } = this.location;
    const url =
      `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${lat}&longitude=${lon}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&temperature_unit=${WEATHER_CONFIG.temperatureUnit}` +
      `&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Forecast API request failed');
    }

    return await response.json();
  }

  async updateWeather() {
    try {
      this.showLoading();

      const [weatherData, forecastData] = await Promise.all([
        this.fetchWeatherData(),
        this.fetchForecastData()
      ]);
      this.displayWeather(weatherData, forecastData);
    } catch (error) {
      console.error('Weather update failed:', error);
      this.showError('Failed to update weather');
    }
  }

  displayWeather(data, forecastData) {
    const current = data.current_weather;
    const condition = WEATHER_CONDITIONS[current.weathercode] || WEATHER_CONDITIONS[0];
    const tempUnit = WEATHER_CONFIG.temperatureUnit === 'celsius' ? '°C' : '°F';
    const windUnit = WEATHER_CONFIG.windSpeedUnit;
    const forecastHTML = this.displayForecast(forecastData, tempUnit);

    const html = `
      <div class="weather-content">
        <div class="weather-header">
          <h3 class="weather-location">${this.location.city}</h3>
          <p class="weather-date">${this.formatDate(new Date())}</p>
        </div>

        <div class="weather-main">
          <div class="weather-temp">${Math.round(current.temperature)}${tempUnit}</div>
          <div class="weather-condition">
            <div class="weather-icon">${condition.icon}</div>
            <p>${condition.description}</p>
          </div>
        </div>

        <div class="weather-details">
          <div class="weather-detail">
            <p class="detail-label">Wind Speed</p>
            <p class="detail-value">${Math.round(current.windspeed)} ${windUnit}</p>
          </div>
          <div class="weather-detail">
            <p class="detail-label">Wind Direction</p>
            <p class="detail-value">${this.getWindDirection(current.winddirection)}</p>
          </div>
          <div class="weather-detail">
            <p class="detail-label">Today's High</p>
            <p class="detail-value">${Math.round(data.daily.temperature_2m_max[0])}${tempUnit}</p>
          </div>
          <div class="weather-detail">
            <p class="detail-label">Today's Low</p>
            <p class="detail-value">${Math.round(data.daily.temperature_2m_min[0])}${tempUnit}</p>
          </div>
        </div>

        ${forecastHTML}
      </div>
    `;

    this.container.innerHTML = html;
  }

  displayForecast(data, tempUnit) {
    const forecastDays = data.daily.time.slice(1, 6).map((date, index) => {
      const weatherCode = data.daily.weathercode[index + 1];
      const condition = WEATHER_CONDITIONS[weatherCode] || WEATHER_CONDITIONS[0];
      const high = Math.round(data.daily.temperature_2m_max[index + 1]);
      const low = Math.round(data.daily.temperature_2m_min[index + 1]);
      const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });

      return `
        <div class="forecast-day">
          <p class="forecast-date">${dayName}</p>
          <div class="forecast-icon">${condition.icon}</div>
          <p class="forecast-temps">${high}${tempUnit} / ${low}${tempUnit}</p>
        </div>
      `;
    }).join('');

    return `
      <div class="weather-forecast">
        <h4>5-Day Forecast</h4>
        <div class="forecast-grid">
          ${forecastDays}
        </div>
      </div>
    `;
  }

  showLoading() {
    this.container.innerHTML = `
      <div class="weather-loading">
        <span class="loading-spinner"></span>
        <p>Loading weather data...</p>
      </div>
    `;
  }

  showError(message) {
    this.container.innerHTML = `
      <div class="weather-error">
        <p class="error-message">⚠️ ${message}</p>
        <button class="retry-button" onclick="weatherWidget.updateWeather()">
          Retry
        </button>
      </div>
    `;
  }

  formatDate(date) {
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
  }

  getWindDirection(degrees) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  }

  startAutoUpdate() {
    // Clear any existing timer
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    // Set up new timer
    this.updateTimer = setInterval(() => {
      this.updateWeather();
    }, WEATHER_CONFIG.updateInterval);
  }

  destroy() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
  }
}

// Initialize weather widget when DOM is loaded
let weatherWidget;
let weatherWidgetConfig;
document.addEventListener('DOMContentLoaded', () => {
  weatherWidgetConfig = new WeatherWidgetConfig();
  weatherWidget = new WeatherWidget();
  weatherWidget.init();
});
