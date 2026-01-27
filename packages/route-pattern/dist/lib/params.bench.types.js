import { bench } from '@ark/attest';
// Simple benchmark: Basic route patterns with single features
bench('Params - Small', () => {
    return {};
}).types([1206, 'instantiations']);
// Medium benchmark: Moderate complexity with combined features (~10 patterns)
bench('Params - Medium', () => {
    return {};
}).types([19799, 'instantiations']);
// Large/Complex benchmark: 100 route patterns with various feature combinations
bench('Params - Large', () => {
    return {};
}).types([204789, 'instantiations']);
