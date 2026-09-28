import React from 'react';

const License = () => {
    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">License Agreement</h2>
                <p className="text-gray-500 text-sm mt-1">End User License Agreement for Invoice Software</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-sans text-gray-700 leading-relaxed">
                <div className="max-w-4xl mx-auto space-y-6">

                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                        <h3 className="text-lg font-bold text-blue-800 mb-1">Company Name: Rabtoise Technologies</h3>
                        <p className="text-blue-700 font-medium">Product: Billing Software</p>
                    </div>

                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">1. Grant of License</h3>
                        <p>Rabtoise Technologies grants the user a non-exclusive, non-transferable, limited license to use the Billing Software based on the selected license type.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">2. License Types</h3>
                        <div className="pl-4 space-y-4">
                            <div>
                                <h4 className="font-semibold text-gray-800">a) Subscription License</h4>
                                <ul className="list-disc pl-5 mt-1 space-y-1 text-gray-600">
                                    <li>Access is provided for the chosen subscription period (Monthly / Quarterly / Yearly).</li>
                                    <li>License remains active only while the subscription is valid.</li>
                                    <li>Non-renewal may lead to access restrictions or suspension.</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-800">b) Lifetime License</h4>
                                <ul className="list-disc pl-5 mt-1 space-y-1 text-gray-600">
                                    <li>One-time payment for perpetual access to the purchased version.</li>
                                    <li>Major future upgrades may not be included unless specified.</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">3. User Restrictions</h3>
                        <p className="mb-2">Users shall not:</p>
                        <ul className="list-disc pl-5 space-y-1 text-gray-600">
                            <li>Resell, sublicense, lease, or distribute the software</li>
                            <li>Reverse engineer or modify the software</li>
                            <li>Share account credentials with unauthorized users</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">4. Ownership & Intellectual Property</h3>
                        <ul className="list-disc pl-5 space-y-1 text-gray-600">
                            <li>The software, code, design, and documentation are the exclusive property of Rabtoise Technologies.</li>
                            <li>This agreement grants usage rights only, not ownership.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">5. Updates & Maintenance</h3>
                        <ul className="list-disc pl-5 space-y-1 text-gray-600">
                            <li>Subscription users receive updates, enhancements, and security fixes as part of the plan.</li>
                            <li>Lifetime users receive maintenance updates; major feature upgrades may require additional licensing.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">6. Data & Privacy</h3>
                        <ul className="list-disc pl-5 space-y-1 text-gray-600">
                            <li>User data remains property of the user.</li>
                            <li>Rabtoise Technologies will take reasonable measures to protect data.</li>
                            <li>Rabtoise is not liable for data loss due to user actions, third-party services, or force majeure.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">7. Termination</h3>
                        <p className="mb-2">Rabtoise Technologies may suspend or terminate the license if:</p>
                        <ul className="list-disc pl-5 space-y-1 text-gray-600">
                            <li>Terms are violated</li>
                            <li>Payments are not made</li>
                            <li>Software misuse is detected</li>
                        </ul>
                        <p className="mt-2 text-red-600 font-medium">Upon termination, access is revoked immediately.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">8. Limitation of Liability</h3>
                        <p className="mb-2">Rabtoise Technologies is not liable for:</p>
                        <ul className="list-disc pl-5 space-y-1 text-gray-600">
                            <li>Business interruption</li>
                            <li>Data loss</li>
                            <li>Revenue loss</li>
                            <li>Indirect or consequential damages</li>
                        </ul>
                        <p className="mt-2 italic">Software is provided “AS IS” without warranties.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">9. Support</h3>
                        <ul className="list-disc pl-5 space-y-1 text-gray-600">
                            <li>Support included as per chosen plan.</li>
                            <li>Premium support may be provided for higher plans.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">10. Governing Law</h3>
                        <ul className="list-disc pl-5 space-y-1 text-gray-600">
                            <li>This agreement is governed by the laws of India.</li>
                            <li>Disputes will be under the jurisdiction of Tamil Nadu Courts.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">11. Acceptance</h3>
                        <p className="font-medium text-gray-800">By using, installing, or accessing the software, the user agrees to this License Agreement.</p>
                    </section>

                    <div className="pt-6 border-t border-gray-200 mt-8">
                        <h3 className="text-md font-bold text-gray-800 mb-3">Contact Information</h3>
                        <div className="flex flex-col space-y-2 text-sm">
                            <span className="font-semibold text-gray-900">Rabtoise Technologies</span>
                            <a href="mailto:support@rabtoise.org" className="text-blue-600 hover:underline flex items-center gap-2">
                                <span>📧</span> support@rabtoise.org
                            </a>
                            <a href="https://rabtoise.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-2">
                                <span>🌐</span> https://rabtoise.org
                            </a>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default License;
