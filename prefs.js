import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AviationWeatherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Create a preferences page
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        // Create a preferences group
        const group = new Adw.PreferencesGroup({
            title: _('Airport Settings'),
            description: _('Configure which airport to display METAR data for'),
        });
        page.add(group);

        // Airport ICAO code entry
        const airportRow = new Adw.EntryRow({
            title: _('Airport ICAO Code'),
            text: settings.get_string('airport'),
        });
        airportRow.connect('changed', () => {
            const text = airportRow.get_text().toUpperCase();
            if (text.length === 4 && /^[A-Z]{4}$/.test(text)) {
                settings.set_string('airport', text);
            }
        });
        group.add(airportRow);

        // Update interval
        const intervalGroup = new Adw.PreferencesGroup({
            title: _('Update Settings'),
            description: _('Configure how often to fetch new data'),
        });
        page.add(intervalGroup);

        const intervals = [
            { value: 60, label: _('1 minute') },
            { value: 120, label: _('2 minutes') },
            { value: 300, label: _('5 minutes') },
            { value: 600, label: _('10 minutes') },
            { value: 900, label: _('15 minutes') },
        ];

        const intervalModel = new Gtk.StringList();
        intervals.forEach(i => intervalModel.append(i.label));

        const intervalRow = new Adw.ComboRow({
            title: _('Update Interval'),
            subtitle: _('How often to fetch new METAR data'),
            model: intervalModel,
        });

        // Set current value
        const currentInterval = settings.get_int('update-interval');
        const currentIndex = intervals.findIndex(i => i.value === currentInterval);
        if (currentIndex >= 0) {
            intervalRow.set_selected(currentIndex);
        }

        intervalRow.connect('notify::selected', () => {
            const selected = intervalRow.get_selected();
            if (selected >= 0 && selected < intervals.length) {
                settings.set_int('update-interval', intervals[selected].value);
            }
        });

        intervalGroup.add(intervalRow);

        // Info group
        const infoGroup = new Adw.PreferencesGroup({
            title: _('Information'),
        });
        page.add(infoGroup);

        const infoRow = new Adw.ActionRow({
            title: _('Common ICAO Codes'),
            subtitle: _('EDMA (Augsburg), EDDM (Munich), EDDF (Frankfurt), EDDL (Düsseldorf)'),
        });
        infoGroup.add(infoRow);

        // Flight Rules Page
        const flightRulesPage = new Adw.PreferencesPage({
            title: _('Flight Rules'),
            icon_name: 'airplane-mode-symbolic',
        });
        window.add(flightRulesPage);

        // Flight Rules explanation
        const frInfoGroup = new Adw.PreferencesGroup({
            title: _('Flight Category Thresholds'),
            description: _('Configure VFR/MVFR/IFR/LIFR thresholds (FAA defaults). Category is determined by the worse of visibility OR ceiling.'),
        });
        flightRulesPage.add(frInfoGroup);

        const frLegendRow = new Adw.ActionRow({
            title: _('Color Legend'),
            subtitle: _('🟢 VFR (Green)  🔵 MVFR (Blue)  🔴 IFR (Red)  🟣 LIFR (Magenta)'),
        });
        frInfoGroup.add(frLegendRow);

        // VFR thresholds
        const vfrGroup = new Adw.PreferencesGroup({
            title: _('VFR - Visual Flight Rules'),
            description: _('Conditions above these thresholds'),
        });
        flightRulesPage.add(vfrGroup);

        const vfrVisRow = new Adw.SpinRow({
            title: _('Visibility Threshold'),
            subtitle: _('Greater than (statute miles)'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 10,
                step_increment: 0.5,
                value: settings.get_double('vfr-visibility'),
            }),
            digits: 1,
        });
        vfrVisRow.connect('notify::value', () => {
            settings.set_double('vfr-visibility', vfrVisRow.get_value());
        });
        vfrGroup.add(vfrVisRow);

        const vfrCeilRow = new Adw.SpinRow({
            title: _('Ceiling Threshold'),
            subtitle: _('Greater than (feet AGL)'),
            adjustment: new Gtk.Adjustment({
                lower: 500,
                upper: 5000,
                step_increment: 100,
                value: settings.get_int('vfr-ceiling'),
            }),
            digits: 0,
        });
        vfrCeilRow.connect('notify::value', () => {
            settings.set_int('vfr-ceiling', vfrCeilRow.get_value());
        });
        vfrGroup.add(vfrCeilRow);

        // MVFR thresholds
        const mvfrGroup = new Adw.PreferencesGroup({
            title: _('MVFR - Marginal VFR'),
            description: _('Conditions between these thresholds and VFR'),
        });
        flightRulesPage.add(mvfrGroup);

        const mvfrVisRow = new Adw.SpinRow({
            title: _('Visibility Threshold'),
            subtitle: _('Greater than or equal to (statute miles)'),
            adjustment: new Gtk.Adjustment({
                lower: 0.5,
                upper: 5,
                step_increment: 0.5,
                value: settings.get_double('mvfr-visibility'),
            }),
            digits: 1,
        });
        mvfrVisRow.connect('notify::value', () => {
            settings.set_double('mvfr-visibility', mvfrVisRow.get_value());
        });
        mvfrGroup.add(mvfrVisRow);

        const mvfrCeilRow = new Adw.SpinRow({
            title: _('Ceiling Threshold'),
            subtitle: _('Greater than or equal to (feet AGL)'),
            adjustment: new Gtk.Adjustment({
                lower: 200,
                upper: 3000,
                step_increment: 100,
                value: settings.get_int('mvfr-ceiling'),
            }),
            digits: 0,
        });
        mvfrCeilRow.connect('notify::value', () => {
            settings.set_int('mvfr-ceiling', mvfrCeilRow.get_value());
        });
        mvfrGroup.add(mvfrCeilRow);

        // IFR thresholds
        const ifrGroup = new Adw.PreferencesGroup({
            title: _('IFR - Instrument Flight Rules'),
            description: _('Conditions between these thresholds and MVFR (below = LIFR)'),
        });
        flightRulesPage.add(ifrGroup);

        const ifrVisRow = new Adw.SpinRow({
            title: _('Visibility Threshold'),
            subtitle: _('Greater than or equal to (statute miles)'),
            adjustment: new Gtk.Adjustment({
                lower: 0.25,
                upper: 3,
                step_increment: 0.25,
                value: settings.get_double('ifr-visibility'),
            }),
            digits: 2,
        });
        ifrVisRow.connect('notify::value', () => {
            settings.set_double('ifr-visibility', ifrVisRow.get_value());
        });
        ifrGroup.add(ifrVisRow);

        const ifrCeilRow = new Adw.SpinRow({
            title: _('Ceiling Threshold'),
            subtitle: _('Greater than or equal to (feet AGL)'),
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 1000,
                step_increment: 50,
                value: settings.get_int('ifr-ceiling'),
            }),
            digits: 0,
        });
        ifrCeilRow.connect('notify::value', () => {
            settings.set_int('ifr-ceiling', ifrCeilRow.get_value());
        });
        ifrGroup.add(ifrCeilRow);

        // LIFR note
        const lifrGroup = new Adw.PreferencesGroup({
            title: _('LIFR - Low IFR'),
            description: _('Conditions below IFR thresholds are classified as LIFR'),
        });
        flightRulesPage.add(lifrGroup);
    }
}
