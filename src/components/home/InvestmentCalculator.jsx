import React, { useState, useMemo } from 'react';
import { Calculator, TrendingUp, ArrowRight } from 'lucide-react';
import { formatPriceBangladeshi } from '../../utils/propertyFormatting';

export default function InvestmentCalculator({ onOpenVipModal }) {
  // Property value in Taka (Default: ৳ 3.5 Crore = 35,000,000)
  const [propertyPrice, setPropertyPrice] = useState(35000000);
  // Down payment percentage
  const [downPaymentPercent, setDownPaymentPercent] = useState(30);
  // Tenure in years
  const [tenureYears, setTenureYears] = useState(4);

  // Calculations
  const downPaymentAmount = useMemo(() => {
    return (propertyPrice * downPaymentPercent) / 100;
  }, [propertyPrice, downPaymentPercent]);

  const remainingBalance = useMemo(() => {
    return propertyPrice - downPaymentAmount;
  }, [propertyPrice, downPaymentAmount]);

  const monthlyInstallment = useMemo(() => {
    const totalMonths = tenureYears * 12;
    // Assuming standard structured construction milestone installments or home loan
    return Math.round(remainingBalance / totalMonths);
  }, [remainingBalance, tenureYears]);

  // Projected 5-year capital appreciation in Jolshiri / Purbachal growth corridor (~38%)
  const projectedAppreciation = useMemo(() => {
    const rate = 0.38;
    return Math.round(propertyPrice * (1 + rate));
  }, [propertyPrice]);

  return (
    <section className="py-24 bg-white relative overflow-hidden border-t border-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand-primary mb-3">
            <Calculator size={14} className="text-brand-primary" />
            <span>Financial Planning & Growth</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-serif text-brand-dark tracking-tight mb-4">
            Interactive Investment & Yield Estimator
          </h2>
          <p className="text-sm sm:text-base text-brand-text/75 font-light leading-relaxed">
            Model your acquisition schedule across construction phases or long-term private financing, complete with historical Jolshiri capital appreciation projections.
          </p>
        </div>

        {/* Interactive Calculator Body */}
        <div className="max-w-5xl mx-auto bg-brand-neutral rounded-3xl p-6 sm:p-10 border border-gray-200/80 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Controls Column (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Slider 1: Property Value */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-brand-dark">
                  Target Residence Value
                </label>
                <span className="text-lg sm:text-xl font-serif font-bold text-brand-primary">
                  ৳ {formatPriceBangladeshi(propertyPrice)}
                </span>
              </div>
              <input
                type="range"
                min={15000000} // 1.5 Cr
                max={100000000} // 10 Cr
                step={2500000} // 25 Lakhs
                value={propertyPrice}
                onChange={(e) => setPropertyPrice(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
              />
              <div className="flex justify-between text-[11px] text-gray-400 mt-1.5 font-medium">
                <span>৳ 1.50 Cr</span>
                <span>৳ 5.00 Cr</span>
                <span>৳ 10.00 Cr</span>
              </div>
            </div>

            {/* Slider 2: Down Payment */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-brand-dark">
                  Down Payment ({downPaymentPercent}%)
                </label>
                <span className="text-base sm:text-lg font-serif font-bold text-brand-dark">
                  ৳ {formatPriceBangladeshi(downPaymentAmount)}
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={60}
                step={5}
                value={downPaymentPercent}
                onChange={(e) => setDownPaymentPercent(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
              />
              <div className="flex justify-between text-[11px] text-gray-400 mt-1.5 font-medium">
                <span>20% (Minimum)</span>
                <span>35% (Recommended)</span>
                <span>60%</span>
              </div>
            </div>

            {/* Tenure Select */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-3">
                Milestone Installment Schedule / Tenure
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '3 Yrs (Handover)', val: 3 },
                  { label: '4 Yrs (Standard)', val: 4 },
                  { label: '5 Yrs (Extended)', val: 5 },
                  { label: '10 Yrs (Bank)', val: 10 },
                ].map(item => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setTenureYears(item.val)}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                      tenureYears === item.val
                        ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                        : 'bg-white text-brand-dark border-gray-200 hover:border-brand-primary/50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Results Summary Box (5 cols) */}
          <div className="lg:col-span-5 bg-brand-dark text-white rounded-2xl p-6 sm:p-8 border border-brand-accent/20 shadow-2xl flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-[0.25em] text-brand-accent font-bold block mb-1">
                Estimated Breakdown
              </span>
              <h3 className="font-serif text-2xl text-white mb-6">Payment Horizon</h3>

              <div className="space-y-4 pb-6 border-b border-white/10">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/70">Initial Down Payment:</span>
                  <span className="font-bold text-brand-accent text-sm">৳ {formatPriceBangladeshi(downPaymentAmount)}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/70">Remaining Milestone Balance:</span>
                  <span className="font-bold text-white text-sm">৳ {formatPriceBangladeshi(remainingBalance)}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="text-xs text-white/90 font-medium">Est. Monthly Allocation:</span>
                  <span className="font-serif text-xl sm:text-2xl font-bold text-white">
                    ৳ {monthlyInstallment.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Capital Growth Insight */}
              <div className="mt-6 bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 text-xs font-bold text-brand-accent mb-1">
                  <TrendingUp size={16} />
                  <span>Jolshiri 5-Yr Projected Value (~38%+)</span>
                </div>
                <div className="text-xl font-serif font-bold text-white">
                  ৳ {formatPriceBangladeshi(projectedAppreciation)}
                </div>
                <p className="text-[11px] text-white/60 mt-1">
                  Based on historical infrastructure delivery across Jolshiri, Purbachal & Gulshan corridors.
                </p>
              </div>
            </div>

            <button
              onClick={() => onOpenVipModal(`Calculated Plan: ৳ ${formatPriceBangladeshi(propertyPrice)} with ${downPaymentPercent}% Down Payment`)}
              className="mt-8 w-full bg-brand-accent text-brand-dark hover:bg-white py-3.5 px-4 rounded-lg text-xs font-bold uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <span>Request Custom Payment Schedule</span>
              <ArrowRight size={14} />
            </button>
          </div>

        </div>

      </div>
    </section>
  );
}
