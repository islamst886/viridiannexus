import React, { useState } from 'react';

export default function Booking() {
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen bg-viridian-50 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-pine-900 mb-4">Book Your Property</h1>
          <p className="text-pine-600">Complete the reservation process in three easy steps.</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-12 relative">
          <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 -z-10 -translate-y-1/2"></div>
          <div className="absolute left-0 top-1/2 h-1 bg-viridian-500 -z-10 -translate-y-1/2 transition-all duration-500" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
          
          {[1, 2, 3].map((num) => (
            <div key={num} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${step >= num ? 'bg-viridian-600 text-white shadow-md' : 'bg-white text-gray-400 border-2 border-gray-200'}`}>
              {step > num ? '✓' : num}
            </div>
          ))}
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-viridian-100">
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-pine-900 mb-6">Select Property Unit</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-pine-700 mb-2">Select Project</label>
                  <select className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-viridian-500 focus:border-viridian-500 outline-none transition-shadow bg-white">
                    <option>The Sapphire Penthouse</option>
                    <option>Emerald Heights</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-pine-700 mb-2">Select Unit Type</label>
                  <select className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-viridian-500 focus:border-viridian-500 outline-none transition-shadow bg-white">
                    <option>4 BHK Luxury (4,500 sqft)</option>
                    <option>3 BHK Premium (3,200 sqft)</option>
                  </select>
                </div>
                <button onClick={() => setStep(2)} className="w-full bg-viridian-600 text-white font-bold py-4 rounded-xl mt-8 hover:bg-viridian-700 transition-colors shadow-lg shadow-viridian-200">
                  Continue to Details
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-pine-900 mb-6">Personal Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-pine-700 mb-2">First Name</label>
                  <input type="text" className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-viridian-500 outline-none" placeholder="John" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-pine-700 mb-2">Last Name</label>
                  <input type="text" className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-viridian-500 outline-none" placeholder="Doe" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-pine-700 mb-2">Email Address</label>
                  <input type="email" className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-viridian-500 outline-none" placeholder="john@example.com" />
                </div>
              </div>
              <div className="flex space-x-4 mt-8">
                <button onClick={() => setStep(1)} className="flex-1 bg-gray-100 text-pine-700 font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors">Back</button>
                <button onClick={() => setStep(3)} className="flex-[2] bg-viridian-600 text-white font-bold py-4 rounded-xl hover:bg-viridian-700 transition-colors shadow-lg shadow-viridian-200">Review & Payment</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-pine-900 mb-6">Confirm Reservation</h2>
              <div className="bg-viridian-50 p-6 rounded-xl border border-viridian-200 mb-8">
                <h3 className="font-bold text-pine-900 mb-4">Reservation Summary</h3>
                <div className="space-y-3 text-sm text-pine-700">
                  <div className="flex justify-between"><span>Property:</span> <span className="font-semibold text-pine-900">The Sapphire Penthouse</span></div>
                  <div className="flex justify-between"><span>Unit:</span> <span className="font-semibold text-pine-900">4 BHK Luxury (4,500 sqft)</span></div>
                  <div className="flex justify-between"><span>Applicant:</span> <span className="font-semibold text-pine-900">John Doe</span></div>
                  <div className="pt-3 border-t border-viridian-200 flex justify-between font-bold text-lg">
                    <span>Booking Amount:</span>
                    <span className="text-viridian-600">৳ 5,00,000</span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-4">
                <button onClick={() => setStep(2)} className="flex-1 bg-gray-100 text-pine-700 font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors">Back</button>
                <button className="flex-[2] bg-pine-900 text-white font-bold py-4 rounded-xl hover:bg-pine-800 transition-colors shadow-lg">Pay Securely</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
