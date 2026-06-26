import React, { useState, useEffect } from 'react';
import { X, Loader2, CloudSun } from 'lucide-react';
import { PreviewTVBezel } from './PreviewTVBezel';
import { PlaylistItem } from '@/types/playlist';

function mapWeatherCode(code: number) {
  const icons: { [key: number]: string } = {
      0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️",
      51: "🌦️", 53: "🌦️", 60: "🌧️", 61: "🌧️", 63: "🌧️", 65: "🌧️",
      71: "🌨️", 73: "🌨️", 75: "❄️", 80: "🌦️", 81: "🌧️", 82: "🌧️",
      95: "⛈️", 96: "⛈️", 99: "⛈️"
  };
  const labels: { [key: number]: string } = {
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Foggy", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Drizzle",
      60: "Dense drizzle", 61: "Slight rain", 63: "Rain", 65: "Heavy rain",
      71: "Slight snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers",
      81: "Rain showers", 82: "Violent rain showers", 95: "Thunderstorm",
      96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail"
  };
  return { icon: icons[code] || "☁️", label: labels[code] || "Overcast" };
}

export function WeatherAppModal({ editIndex, initialData, onAdd, onEdit, onClose }: { 
  editIndex?: number;
  initialData?: any;
  onAdd: (item: PlaylistItem) => void;
  onEdit: (idx: number, item: PlaylistItem) => void;
  onClose: () => void;
}) {
  const [city, setCity] = useState(initialData?.city || '');
  const [unit, setUnit] = useState(initialData?.unit || 'C');
  const [layout, setLayout] = useState(initialData?.layout || 'Temperature');
  const [forecastDays, setForecastDays] = useState(initialData?.forecastDays || 'Hourly');

  const [weatherData, setWeatherData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!city.trim() || city.length < 3) {
      setWeatherData(null);
      setError('');
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setError('');
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();
        
        if (!geoData.results || geoData.results.length === 0) {
          setError('City not found');
          setIsLoading(false);
          return;
        }

        const location = geoData.results[0];
        const lat = location.latitude;
        const lon = location.longitude;
        const timezone = location.timezone || 'Europe/London';

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,weathercode&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=${encodeURIComponent(timezone)}`);
        const data = await weatherRes.json();
        
        setWeatherData({
          current: data.current_weather,
          daily: data.daily,
          hourly: data.hourly,
          locationName: location.name
        });
        
      } catch (err) {
        setError('Failed to fetch weather');
      } finally {
        setIsLoading(false);
      }
    }, 800);
    
    return () => clearTimeout(timeoutId);
  }, [city]);

  function getTemperature(celsiusTemp: number): number {
    return unit === 'F' ? Math.round((celsiusTemp * 9 / 5) + 32) : Math.round(celsiusTemp);
  }

  function save() {
    if (!city.trim()) return;
    const item: PlaylistItem = {
      id: `app_${Date.now()}`,
      name: `Weather: ${weatherData?.locationName || city}`,
      thumbLink: '',
      duration: 15,
      contentType: 'APP_WEATHER',
      metadata: { city: weatherData?.locationName || city, unit, layout, forecastDays }
    };
    if (editIndex !== undefined) {
      onEdit(editIndex, item);
    } else {
      onAdd(item);
    }
    onClose();
  }

  const currentInfo = weatherData ? mapWeatherCode(weatherData.current.weathercode) : null;

  return (
    <div className="pl-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="pl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 960, minHeight: 600, display: 'flex', flexDirection: 'column' }}>
        <div className="pl-modal-hd">
          <h3>Configure Weather App</h3>
          <button className="pl-modal-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pl-modal-bd" style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: 24, padding: '20px' }}>
          {/* Left Controls */}
          <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p className="pl-label">City Name</p>
              <input className="pl-input" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. London, UK" autoFocus />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <p className="pl-label">Unit</p>
                <select className="pl-input" value={unit} onChange={e => setUnit(e.target.value)}>
                  <option value="C">Celsius (°C)</option>
                  <option value="F">Fahrenheit (°F)</option>
                </select>
              </div>
              <div>
                <p className="pl-label">Layout</p>
                <select className="pl-input" value={layout} onChange={e => setLayout(e.target.value)}>
                  <option value="Temperature">Temperature Only</option>
                  <option value="Sentence">Detailed Sentence</option>
                </select>
              </div>
            </div>
            <div>
              <p className="pl-label">Forecast Display</p>
              <select className="pl-input" value={forecastDays} onChange={e => setForecastDays(e.target.value)}>
                <option value="Hourly">Hourly Forecast</option>
                <option value="3 Days">3 Days Forecast</option>
              </select>
            </div>
          </div>

          {/* Right Preview - LED TV Style */}
          <PreviewTVBezel>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', position: 'relative' }}>
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#fff', opacity: 0.8 }}>
                  <Loader2 className="animate-spin" size={40} style={{ marginBottom: 16 }} />
                  <p>Fetching weather...</p>
                </div>
              ) : error ? (
                <div style={{ textAlign: 'center', color: '#ffb3b3', background: 'rgba(0,0,0,0.4)', padding: '16px 24px', borderRadius: '8px' }}>
                  <p style={{ margin: 0 }}>{error}</p>
                </div>
              ) : !weatherData ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.7)' }}>
                  <div style={{ background: 'rgba(255,255,255,0.1)', padding: '24px', borderRadius: '50%', marginBottom: '16px' }}>
                    <CloudSun size={48} strokeWidth={1.5} />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>Enter a city to see the preview</p>
                </div>
              ) : (
                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '360px', color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                  {layout === 'Temperature' ? (
                    <div style={{ textAlign: 'center' }}>
                      <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>{weatherData.locationName}</h2>
                      <div style={{ fontSize: '4rem', fontWeight: 700, margin: '16px 0' }}>
                        {getTemperature(weatherData.current.temperature)}°{unit}
                      </div>
                      <p style={{ margin: 0, fontSize: '1.2rem', opacity: 0.9 }}>{currentInfo?.icon} {currentInfo?.label}</p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ fontSize: '2.5rem' }}>{currentInfo?.icon}</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>{getTemperature(weatherData.current.temperature)}°{unit}</div>
                      </div>
                      <p style={{ marginTop: '16px', fontSize: '1.2rem', lineHeight: 1.4 }}>
                        {weatherData.locationName}: It is currently {currentInfo?.label.toLowerCase()} with a temperature of {getTemperature(weatherData.current.temperature)}°{unit}.
                      </p>
                    </div>
                  )}
                  
                  <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between' }}>
                    {forecastDays === 'Hourly' ? (
                      [1, 3, 5].map((hourOffset, i) => {
                        const temp = weatherData.hourly.temperature_2m[hourOffset];
                        const code = weatherData.hourly.weathercode[hourOffset];
                        const timeStr = weatherData.hourly.time[hourOffset];
                        const hour = new Date(timeStr).getHours();
                        return (
                          <div key={i} style={{ textAlign: 'center' }}>
                            <p style={{ margin: '0 0 8px', fontSize: '0.8rem', opacity: 0.8 }}>{hour}:00</p>
                            <div style={{ margin: '4px 0' }}>{mapWeatherCode(code).icon}</div>
                            <p style={{ margin: 0, fontWeight: 600 }}>{getTemperature(temp)}°</p>
                          </div>
                        );
                      })
                    ) : (
                      [1, 2, 3].map((dayOffset, i) => {
                        const maxT = weatherData.daily.temperature_2m_max[dayOffset];
                        const code = weatherData.daily.weathercode[dayOffset];
                        const timeStr = weatherData.daily.time[dayOffset];
                        const date = new Date(timeStr);
                        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                        return (
                          <div key={i} style={{ textAlign: 'center' }}>
                            <p style={{ margin: '0 0 8px', fontSize: '0.8rem', opacity: 0.8 }}>{dayName}</p>
                            <div style={{ margin: '4px 0' }}>{mapWeatherCode(code).icon}</div>
                            <p style={{ margin: 0, fontWeight: 600 }}>{getTemperature(maxT)}°</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </PreviewTVBezel>
        </div>
        <div className="pl-modal-ft">
          <button className="pl-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="pl-btn-primary" onClick={save} disabled={!city.trim()}>
            {editIndex !== undefined ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
