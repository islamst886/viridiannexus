import React from 'react';

export default function ProjectProgress() {
  const milestones = [
    { date: 'September 2026', title: 'Interior Finishing', description: 'Installing premium fittings and marble flooring in main lobbies.', status: 'current' },
    { date: 'June 2026', title: 'Structural Completion', description: 'Topping out ceremony completed for the 25th floor.', status: 'completed' },
    { date: 'January 2026', title: 'Foundation & Basement', description: 'Completed massive raft foundation and 3 levels of basement parking.', status: 'completed' },
    { date: 'October 2025', title: 'Groundbreaking', description: 'Official project launch and site excavation.', status: 'completed' },
  ];

  return (
    <div className="min-h-screen bg-white py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-pine-900 mb-4 text-center">Project Progress</h1>
        <p className="text-lg text-pine-600 text-center mb-16">Tracking the development milestones of The Sapphire Penthouse.</p>

        <div className="relative border-l-4 border-viridian-200 ml-6 md:ml-12">
          {milestones.map((milestone, idx) => (
            <div key={idx} className="mb-12 ml-10 relative">
              <span className={`absolute -left-12 flex items-center justify-center w-8 h-8 rounded-full -ml-[3px] ring-4 ring-white ${milestone.status === 'current' ? 'bg-viridian-500 animate-pulse' : 'bg-pine-800'}`}>
                {milestone.status === 'completed' ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                ) : (
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                )}
              </span>
              
              <div className="bg-viridian-50 rounded-2xl p-6 shadow-sm border border-viridian-100 hover:shadow-md transition-shadow">
                <span className="text-sm font-bold text-viridian-600 tracking-wider uppercase mb-2 block">{milestone.date}</span>
                <h3 className="text-2xl font-bold text-pine-900 mb-3">{milestone.title}</h3>
                <p className="text-pine-700 leading-relaxed">{milestone.description}</p>
                
                {milestone.status === 'current' && (
                  <div className="mt-6">
                    <div className="flex justify-between text-sm font-medium text-pine-800 mb-2">
                      <span>Phase Completion</span>
                      <span>65%</span>
                    </div>
                    <div className="w-full bg-viridian-200 rounded-full h-2">
                      <div className="bg-viridian-500 h-2 rounded-full" style={{ width: '65%' }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
