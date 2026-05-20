import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css } from '@remix-run/ui';
import { Combobox, ComboboxOption, onComboboxChange } from '@remix-run/ui/combobox';
import { theme } from '@remix-run/ui/theme';
/**
 * @name Combobox Overview
 * @description A searchable combobox with keyboard navigation. Try typing airport names or codes like ord, lax, or jfk.
 */
export default function Example(handle) {
    let value = null;
    return () => (_jsxs("div", { mix: stackCss, children: [_jsxs("div", { mix: fieldCss, children: [_jsx("label", { for: "airport-combobox", mix: labelCss, children: "Airport" }), _jsx(Combobox, { inputId: "airport-combobox", mix: [
                            comboboxCss,
                            onComboboxChange((event) => {
                                value = event.value;
                                void handle.update();
                            }),
                        ], name: "airport", placeholder: "Search airports or codes", children: airportOptions.map((airport) => (_jsx(ComboboxOption, { disabled: airport.disabled, label: airport.label, searchValue: airport.searchValue, value: airport.value }, airport.value))) }), _jsx("div", { mix: helpCss, children: "Try typing `san`, `wash`, or airport codes like `ord`, `lax`, or `jfk`, then use ArrowDown and Enter." })] }), _jsx("p", { mix: valueCss, children: `value=${value ?? 'null'}` })] }));
}
const airportOptions = [
    {
        label: 'Hartsfield-Jackson Atlanta International',
        searchValue: ['atl', 'atlanta', 'hartsfield-jackson atlanta international'],
        value: 'ATL',
    },
    {
        label: 'Austin-Bergstrom International',
        searchValue: ['aus', 'austin', 'austin-bergstrom international'],
        value: 'AUS',
    },
    {
        label: 'Boston Logan International',
        searchValue: ['bos', 'boston', 'boston logan international'],
        value: 'BOS',
    },
    {
        label: 'Baltimore/Washington International',
        searchValue: ['bwi', 'baltimore', 'washington', 'baltimore/washington international'],
        value: 'BWI',
    },
    {
        label: 'Ronald Reagan Washington National',
        searchValue: ['dca', 'reagan', 'washington', 'ronald reagan washington national'],
        value: 'DCA',
    },
    {
        label: 'Denver International',
        searchValue: ['den', 'denver', 'denver international'],
        value: 'DEN',
    },
    {
        label: 'Dallas/Fort Worth International',
        searchValue: ['dfw', 'dallas', 'fort worth', 'dallas/fort worth international'],
        value: 'DFW',
    },
    {
        label: 'Newark Liberty International',
        searchValue: ['ewr', 'newark', 'newark liberty international'],
        value: 'EWR',
    },
    {
        label: 'Daniel K. Inouye International',
        searchValue: ['hnl', 'honolulu', 'daniel k. inouye international'],
        value: 'HNL',
    },
    {
        label: 'Washington Dulles International',
        searchValue: ['iad', 'dulles', 'washington', 'washington dulles international'],
        value: 'IAD',
    },
    {
        label: 'John F. Kennedy International',
        searchValue: ['jfk', 'kennedy', 'new york', 'john f. kennedy international'],
        value: 'JFK',
    },
    {
        label: 'Harry Reid International',
        searchValue: ['las', 'las vegas', 'harry reid international'],
        value: 'LAS',
    },
    {
        label: 'Los Angeles International',
        searchValue: ['lax', 'los angeles', 'los angeles international'],
        value: 'LAX',
    },
    {
        label: 'Orlando International',
        searchValue: ['mco', 'orlando', 'orlando international'],
        value: 'MCO',
    },
    {
        label: 'Miami International',
        searchValue: ['mia', 'miami', 'miami international'],
        value: 'MIA',
    },
    {
        label: "Chicago O'Hare International",
        searchValue: ['ord', 'ohare', 'chicago', "chicago o'hare international"],
        value: 'ORD',
    },
    {
        label: 'Portland International',
        searchValue: ['pdx', 'portland', 'portland international'],
        value: 'PDX',
    },
    {
        label: 'San Diego International',
        searchValue: ['san', 'san diego', 'san diego international'],
        value: 'SAN',
    },
    {
        label: 'San Francisco International',
        searchValue: ['sfo', 'san francisco', 'san francisco international'],
        value: 'SFO',
    },
    {
        disabled: true,
        label: 'San Jose Mineta International',
        searchValue: ['sjc', 'san jose', 'san jose mineta international'],
        value: 'SJC',
    },
];
const comboboxCss = css({
    width: '16rem',
});
const stackCss = css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.space.sm,
    width: '100%',
});
const fieldCss = css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.space.xs,
});
const labelCss = css({
    margin: 0,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
});
const helpCss = css({
    fontSize: theme.fontSize.xs,
    lineHeight: theme.lineHeight.relaxed,
    color: theme.colors.text.secondary,
});
const valueCss = css({
    margin: 0,
    fontFamily: theme.fontFamily.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.secondary,
});
//# sourceMappingURL=overview.demo.js.map