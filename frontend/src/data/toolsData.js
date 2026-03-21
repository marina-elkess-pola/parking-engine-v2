export const toolsData = [
    {
        id: 'rsi',

        name: 'Residential Scheme Intelligence',

        tagline:
            'Spatial efficiency & financial performance analysis inside Revit',

        description:
            'RSI is a professional Revit plugin that evaluates residential schemes by analyzing how floor area is distributed between sellable space, circulation, and core elements.',

        fullDescription:
            'RSI analyzes Net-to-Gross efficiency, Core and Circulation ratios, and benchmarks performance against predefined residential typologies. It also evaluates financial impact and identifies performance gaps to support better design decisions.',

        features: [
            'Net-to-gross efficiency analysis',
            'Core & circulation breakdown',
            'Benchmark comparison (mid-rise, high-rise, courtyard)',
            'Performance gap analysis',
            'Financial feasibility insights',
            'Heatmap visualization inside Revit',
        ],

        pricing: {
            monthly: 49,
            yearly: 390,
        },

        links: {
            page: '/tools/rsi',
            download: 'https://genfabtools.com/download/RSI_Setup.exe',
            docs: 'https://genfabtools.com/docs/rsi/index.html',
        },

        image: '/images/rsi/efficiency-dashboard.png',
        logo: '/images/rsi/RSI32.png',

        category: 'Revit Plugin',
        isPaid: true,
    },
];