# Aviation Weather - GNOME Shell Extension

A GNOME Shell extension that displays real-time METAR (Meteorological Aerodrome Report) data in your top panel. Perfect for pilots, aviation enthusiasts, and weather geeks.

## Features

- **Live METAR Data**: Fetches current weather data from NOAA's Aviation Weather Center API
- **Flight Category Indicator**: Color-coded dot showing VFR/MVFR/IFR/LIFR conditions at a glance
  - Green: VFR (Visual Flight Rules)
  - Blue: MVFR (Marginal VFR)
  - Red: IFR (Instrument Flight Rules)
  - Magenta: LIFR (Low IFR)
- **Decoded Weather Info**: Temperature, wind, visibility, and pressure displayed in a readable format
- **Weather Icons**: Dynamic icons based on current conditions (clear, clouds, rain, snow, fog, storms)
- **Configurable Update Interval**: Choose from 1 to 15 minute refresh intervals
- **Customizable Flight Rules Thresholds**: Adjust VFR/MVFR/IFR/LIFR thresholds to your region's standards

## Screenshot

The extension shows:
- A colored flight category dot in your panel
- Weather icon reflecting current conditions
- Airport ICAO code and temperature
- Click to expand for full METAR details

## Installation

### Manual Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/KingBBQ/GnomeMETAR.git
   ```

2. Copy to your GNOME extensions directory:
   ```bash
   cp -r GnomeMETAR ~/.local/share/gnome-shell/extensions/aviationWeather@communitylabs.de
   ```

3. Compile the GSettings schema:
   ```bash
   cd ~/.local/share/gnome-shell/extensions/aviationWeather@communitylabs.de/schemas
   glib-compile-schemas .
   ```

4. Restart GNOME Shell:
   - On X11: Press `Alt+F2`, type `r`, press Enter
   - On Wayland: Log out and log back in

5. Enable the extension:
   ```bash
   gnome-extensions enable aviationWeather@communitylabs.de
   ```

## Configuration

Open the extension preferences to configure:

- **Airport ICAO Code**: Enter any valid 4-letter ICAO airport code (e.g., EDMA, EDDM, KJFK)
- **Update Interval**: How often to fetch new weather data
- **Flight Rules Thresholds**: Customize visibility and ceiling thresholds for each flight category

## Requirements

- GNOME Shell 48
- Internet connection for fetching METAR data

## Data Source

Weather data is provided by [NOAA Aviation Weather Center](https://aviationweather.gov/).

## License

This project is licensed under the GNU General Public License v2.0 or later - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.
