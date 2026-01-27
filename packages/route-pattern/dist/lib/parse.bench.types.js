import { bench } from '@ark/attest';
// Simple benchmark: Basic route patterns with single features
bench('Parse - Small', () => {
    return {};
}).types([101, 'instantiations']);
// Medium benchmark: Moderate complexity with combined features (~10 patterns)
bench('Parse - Medium', () => {
    return {};
}).types([14761, 'instantiations']);
// Large/Complex benchmark: 100 route patterns with various feature combinations
bench('Parse - Large', () => {
    return {};
}).types([164855, 'instantiations']);
