import React from 'react';

export default function About() {
    return (
        <div className="max-w-6xl mx-auto px-6 py-16">

            {/* HEADER */}
            <div className="max-w-3xl">
                <h1 className="text-4xl font-extrabold text-slate-900">
                    About GenFabTools
                </h1>

                <p className="mt-4 text-lg text-slate-600 leading-relaxed">
                    GenFabTools builds specialized digital tools for architects and developers,
                    focused on improving decision-making during early design stages.
                    Our current flagship product, Residential Scheme Intelligence (RSI),
                    helps evaluate residential layouts through performance and financial insights directly inside Revit.
                </p>
            </div>

            {/* MISSION */}
            <div className="mt-12 grid md:grid-cols-2 gap-10">

                <div>
                    <h2 className="text-xl font-bold text-slate-900">Our mission</h2>

                    <p className="mt-3 text-slate-600 leading-relaxed">
                        To bridge the gap between architectural design and financial feasibility
                        by providing tools that make complex analysis simple, fast, and reliable.
                    </p>
                </div>

                <div>
                    <h2 className="text-xl font-bold text-slate-900">What we are building</h2>

                    <ul className="mt-3 space-y-2 text-slate-600">
                        <li>• Performance analysis for residential schemes</li>
                        <li>• Financial feasibility evaluation tools</li>
                        <li>• Design decision support systems inside Revit</li>
                    </ul>
                </div>

            </div>

            {/* VALUES */}
            <div className="mt-16">
                <h2 className="text-xl font-bold text-slate-900">Values</h2>

                <div className="mt-6 grid md:grid-cols-3 gap-6">

                    <div className="p-6 border rounded-xl">
                        <h3 className="font-semibold text-slate-900">Clarity</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            We simplify complex calculations into clear, actionable insights.
                        </p>
                    </div>

                    <div className="p-6 border rounded-xl">
                        <h3 className="font-semibold text-slate-900">Efficiency</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            Our tools are designed to save time and accelerate decision-making.
                        </p>
                    </div>

                    <div className="p-6 border rounded-xl">
                        <h3 className="font-semibold text-slate-900">Reliability</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            Every output is structured to be consistent and dependable for real projects.
                        </p>
                    </div>

                </div>
            </div>

            {/* PRODUCT SECTION */}
            <div className="mt-16">

                <h2 className="text-xl font-bold text-slate-900">
                    Residential Scheme Intelligence (RSI)
                </h2>

                <p className="mt-3 text-slate-600 max-w-3xl leading-relaxed">
                    RSI is our first released tool, developed to support architects and developers
                    in analyzing residential schemes. It provides instant insights into efficiency,
                    unit mix, and financial performance — enabling faster and more informed decisions.
                </p>

            </div>

            {/* TEAM */}
            <div className="mt-16">
                <h2 className="text-xl font-bold text-slate-900">Team</h2>

                <p className="mt-3 text-slate-600">
                    GenFabTools is currently developed as an independent initiative focused on
                    building practical tools for real-world design challenges.
                </p>
            </div>

        </div>
    );
}