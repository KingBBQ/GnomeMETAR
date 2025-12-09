/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// NOAA AWC METAR API
const METAR_API_URL = 'https://aviationweather.gov/api/data/metar';

// Flight category colors (FAA standard)
const FLIGHT_CATEGORY_COLORS = {
    VFR: '#00ff00',    // Green
    MVFR: '#0080ff',   // Blue
    IFR: '#ff0000',    // Red
    LIFR: '#ff00ff',   // Magenta
};

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, _('Aviation Weather'));

        this._extension = extension;
        this._settings = extension.getSettings();
        this._airport = this._settings.get_string('airport');
        this._updateInterval = this._settings.get_int('update-interval');
        this._session = new Soup.Session();
        this._timeoutId = null;

        // Connect to settings changes
        this._settingsChangedId = this._settings.connect('changed', (settings, key) => {
            if (key === 'airport') {
                this._airport = settings.get_string('airport');
                this._metarHeader.label.text = this._airport;
                this._label.text = this._airport;
                this._fetchMetar();
            } else if (key === 'update-interval') {
                this._updateInterval = settings.get_int('update-interval');
                this._restartUpdates();
            }
        });

        // Panel button with icon and label
        this._box = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
        });

        // Flight category indicator dot
        this._flightCategoryDot = new St.Widget({
            style: 'background-color: #888888; border-radius: 6px; margin-right: 4px;',
            width: 12,
            height: 12,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._icon = new St.Icon({
            icon_name: 'weather-few-clouds-symbolic',
            style_class: 'system-status-icon',
        });

        this._label = new St.Label({
            text: this._airport,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._box.add_child(this._flightCategoryDot);
        this._box.add_child(this._icon);
        this._box.add_child(this._label);
        this.add_child(this._box);

        // Build menu
        this._buildMenu();

        // Fetch initial data
        this._fetchMetar();

        // Start periodic updates
        this._startUpdates();
    }

    _buildMenu() {
        // METAR header
        this._metarHeader = new PopupMenu.PopupMenuItem(this._airport, {
            reactive: false,
            style_class: 'metar-header',
        });
        this.menu.addMenuItem(this._metarHeader);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Raw METAR display
        this._rawMetarItem = new PopupMenu.PopupMenuItem(_('Loading...'), {
            reactive: false,
        });
        this.menu.addMenuItem(this._rawMetarItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Decoded info section
        this._tempItem = new PopupMenu.PopupMenuItem(_('Temperature: --'), {
            reactive: false,
        });
        this.menu.addMenuItem(this._tempItem);

        this._windItem = new PopupMenu.PopupMenuItem(_('Wind: --'), {
            reactive: false,
        });
        this.menu.addMenuItem(this._windItem);

        this._visibilityItem = new PopupMenu.PopupMenuItem(_('Visibility: --'), {
            reactive: false,
        });
        this.menu.addMenuItem(this._visibilityItem);

        this._pressureItem = new PopupMenu.PopupMenuItem(_('Pressure: --'), {
            reactive: false,
        });
        this.menu.addMenuItem(this._pressureItem);

        this._flightCategoryItem = new PopupMenu.PopupMenuItem(_('Flight Rules: --'), {
            reactive: false,
        });
        this.menu.addMenuItem(this._flightCategoryItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Last update time
        this._updateTimeItem = new PopupMenu.PopupMenuItem(_('Last update: --'), {
            reactive: false,
        });
        this.menu.addMenuItem(this._updateTimeItem);

        // Refresh button
        const refreshItem = new PopupMenu.PopupMenuItem(_('Refresh'));
        refreshItem.connect('activate', () => {
            this._fetchMetar();
        });
        this.menu.addMenuItem(refreshItem);

        // Settings button
        const settingsItem = new PopupMenu.PopupMenuItem(_('Settings'));
        settingsItem.connect('activate', () => {
            this._extension.openPreferences();
        });
        this.menu.addMenuItem(settingsItem);
    }

    _startUpdates() {
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this._updateInterval,
            () => {
                this._fetchMetar();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _stopUpdates() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
    }

    _restartUpdates() {
        this._stopUpdates();
        this._startUpdates();
    }

    async _fetchMetar() {
        const url = `${METAR_API_URL}?ids=${this._airport}&format=raw`;

        const message = Soup.Message.new('GET', url);

        try {
            const bytes = await this._session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null
            );

            if (message.status_code === 200) {
                const decoder = new TextDecoder('utf-8');
                const text = decoder.decode(bytes.get_data());
                this._parseMetar(text.trim());
            } else {
                this._showError(`HTTP ${message.status_code}`);
            }
        } catch (e) {
            this._showError(e.message);
        }
    }

    _parseMetar(rawMetar) {
        if (!rawMetar || rawMetar.length === 0) {
            this._showError('No data received');
            return;
        }

        // Update raw METAR display
        this._rawMetarItem.label.text = rawMetar;
        this._metarHeader.label.text = `METAR ${this._airport}`;

        // Parse temperature (e.g., "12/08" or "M02/M05")
        const tempMatch = rawMetar.match(/\s(M?\d{2})\/(M?\d{2})\s/);
        if (tempMatch) {
            let temp = tempMatch[1].replace('M', '-');
            let dewpoint = tempMatch[2].replace('M', '-');
            this._tempItem.label.text = `Temperature: ${temp}°C / Dewpoint: ${dewpoint}°C`;

            // Update panel label with temperature
            this._label.text = `${this._airport} ${temp}°C`;
        }

        // Parse wind (e.g., "27015KT" or "VRB03KT" or "27015G25KT")
        const windMatch = rawMetar.match(/\s(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT\s/);
        if (windMatch) {
            const direction = windMatch[1] === 'VRB' ? 'Variable' : `${windMatch[1]}°`;
            const speed = windMatch[2];
            const gust = windMatch[4] ? ` gusting ${windMatch[4]}` : '';
            this._windItem.label.text = `Wind: ${direction} at ${speed}${gust} kt`;
        } else if (rawMetar.includes('00000KT')) {
            this._windItem.label.text = 'Wind: Calm';
        }

        // Parse visibility (e.g., "9999" or "3000" or CAVOK)
        if (rawMetar.includes('CAVOK')) {
            this._visibilityItem.label.text = 'Visibility: CAVOK (>10 km)';
        } else {
            const visMatch = rawMetar.match(/\s(\d{4})(?:\s|[A-Z])/);
            if (visMatch) {
                const vis = parseInt(visMatch[1]);
                if (vis >= 9999) {
                    this._visibilityItem.label.text = 'Visibility: >10 km';
                } else {
                    this._visibilityItem.label.text = `Visibility: ${vis} m`;
                }
            }
        }

        // Parse pressure QNH (e.g., "Q1023" or "A2992")
        const qnhMatch = rawMetar.match(/Q(\d{4})/);
        const altMatch = rawMetar.match(/A(\d{4})/);
        if (qnhMatch) {
            this._pressureItem.label.text = `Pressure: ${qnhMatch[1]} hPa`;
        } else if (altMatch) {
            const inhg = parseInt(altMatch[1]) / 100;
            const hpa = Math.round(inhg * 33.8639);
            this._pressureItem.label.text = `Pressure: ${hpa} hPa (${inhg.toFixed(2)} inHg)`;
        }

        // Update icon based on conditions
        this._updateWeatherIcon(rawMetar);

        // Calculate and display flight category
        this._calculateFlightCategory(rawMetar);

        // Update time
        const now = new Date();
        this._updateTimeItem.label.text = `Last update: ${now.toLocaleTimeString()}`;
    }

    _calculateFlightCategory(rawMetar) {
        // Get thresholds from settings
        const vfrVis = this._settings.get_double('vfr-visibility');
        const vfrCeil = this._settings.get_int('vfr-ceiling');
        const mvfrVis = this._settings.get_double('mvfr-visibility');
        const mvfrCeil = this._settings.get_int('mvfr-ceiling');
        const ifrVis = this._settings.get_double('ifr-visibility');
        const ifrCeil = this._settings.get_int('ifr-ceiling');

        // Parse visibility (meters to statute miles)
        let visibilityMiles = null;
        const visMatch = rawMetar.match(/\s(\d{4})(?:\s|[A-Z])/);
        if (visMatch) {
            const visMeters = parseInt(visMatch[1]);
            visibilityMiles = visMeters / 1609.34; // Convert meters to statute miles
        }
        // Handle US format visibility (e.g., "3SM", "1/2SM", "P6SM")
        const visUSMatch = rawMetar.match(/\s(P)?(\d+)?(?:\/(\d+))?SM\s/);
        if (visUSMatch) {
            if (visUSMatch[1] === 'P') {
                visibilityMiles = 10; // P6SM means greater than 6
            } else if (visUSMatch[2] && visUSMatch[3]) {
                visibilityMiles = parseInt(visUSMatch[2]) / parseInt(visUSMatch[3]);
            } else if (visUSMatch[2]) {
                visibilityMiles = parseInt(visUSMatch[2]);
            }
        }
        // CAVOK means visibility > 10km
        if (rawMetar.includes('CAVOK')) {
            visibilityMiles = 10;
        }

        // Parse ceiling (lowest BKN or OVC layer in feet)
        let ceilingFeet = null;
        const cloudMatches = rawMetar.matchAll(/(BKN|OVC)(\d{3})/g);
        for (const match of cloudMatches) {
            const height = parseInt(match[2]) * 100; // Convert hundreds of feet
            if (ceilingFeet === null || height < ceilingFeet) {
                ceilingFeet = height;
            }
        }
        // CLR, SKC, or CAVOK means no ceiling (unlimited)
        if (rawMetar.includes('CLR') || rawMetar.includes('SKC') || rawMetar.includes('CAVOK')) {
            ceilingFeet = 99999; // Effectively unlimited
        }

        // Determine flight category (worst of visibility or ceiling)
        let category = 'VFR';
        let categoryByVis = 'VFR';
        let categoryByCeil = 'VFR';

        if (visibilityMiles !== null) {
            if (visibilityMiles < ifrVis) {
                categoryByVis = 'LIFR';
            } else if (visibilityMiles < mvfrVis) {
                categoryByVis = 'IFR';
            } else if (visibilityMiles < vfrVis) {
                categoryByVis = 'MVFR';
            }
        }

        if (ceilingFeet !== null) {
            if (ceilingFeet < ifrCeil) {
                categoryByCeil = 'LIFR';
            } else if (ceilingFeet < mvfrCeil) {
                categoryByCeil = 'IFR';
            } else if (ceilingFeet < vfrCeil) {
                categoryByCeil = 'MVFR';
            }
        }

        // Use the most restrictive category
        const categoryOrder = ['VFR', 'MVFR', 'IFR', 'LIFR'];
        const visIndex = categoryOrder.indexOf(categoryByVis);
        const ceilIndex = categoryOrder.indexOf(categoryByCeil);
        category = categoryOrder[Math.max(visIndex, ceilIndex)];

        // Update the UI
        const color = FLIGHT_CATEGORY_COLORS[category];
        this._flightCategoryDot.style = `background-color: ${color}; border-radius: 6px; margin-right: 4px;`;

        let details = category;
        if (visibilityMiles !== null && ceilingFeet !== null && ceilingFeet < 99999) {
            details = `${category} (Vis: ${visibilityMiles.toFixed(1)} SM, Ceil: ${ceilingFeet} ft)`;
        } else if (visibilityMiles !== null) {
            details = `${category} (Vis: ${visibilityMiles.toFixed(1)} SM)`;
        } else if (ceilingFeet !== null && ceilingFeet < 99999) {
            details = `${category} (Ceil: ${ceilingFeet} ft)`;
        }
        this._flightCategoryItem.label.text = `Flight Rules: ${details}`;

        return category;
    }

    _updateWeatherIcon(rawMetar) {
        let iconName = 'weather-clear-symbolic';

        if (rawMetar.includes('TS')) {
            iconName = 'weather-storm-symbolic';
        } else if (rawMetar.includes('SN') || rawMetar.includes('SG')) {
            iconName = 'weather-snow-symbolic';
        } else if (rawMetar.includes('RA') || rawMetar.includes('DZ') || rawMetar.includes('SH')) {
            iconName = 'weather-showers-symbolic';
        } else if (rawMetar.includes('FG') || rawMetar.includes('BR') || rawMetar.includes('HZ')) {
            iconName = 'weather-fog-symbolic';
        } else if (rawMetar.includes('OVC') || rawMetar.includes('BKN')) {
            iconName = 'weather-overcast-symbolic';
        } else if (rawMetar.includes('SCT') || rawMetar.includes('FEW')) {
            iconName = 'weather-few-clouds-symbolic';
        } else if (rawMetar.includes('CLR') || rawMetar.includes('SKC') || rawMetar.includes('CAVOK')) {
            iconName = 'weather-clear-symbolic';
        }

        this._icon.icon_name = iconName;
    }

    _showError(message) {
        this._rawMetarItem.label.text = `Error: ${message}`;
        this._label.text = this._airport;
    }

    destroy() {
        this._stopUpdates();
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        super.destroy();
    }
});

export default class AviationWeatherExtension extends Extension {
    enable() {
        this._indicator = new Indicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}
