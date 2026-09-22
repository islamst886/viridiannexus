import React, { useState, useEffect } from 'react';
import { useGlobalState } from '../context/GlobalState';
import { Link } from 'react-router-dom';
import { CheckCircle, Activity, Calendar, Image as ImageIcon } from 'lucide-react';

export default function ProjectProgress() {
  const { properties, loadingProperties } = useGlobalState();
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Filter properties that actually have milestones
  const propertiesWithMilestones = properties.filter(p => p.milestones && p.milestones.length > 0);

  // Set default selected project when properties load
  useEffect(() => {
    if (!selectedProjectId && propertiesWithMilestones.length > 0) {
      setSelectedProjectId(propertiesWithMilestones[0].id);
    }
  }, [propertiesWithMilestones, selectedProjectId]);

  const selectedProperty = properties.find(p => p.id === selectedProjectId);
  const milestones = selectedProperty?.milestones || [];

  if (loadingProperties) {
    return <div className="min-h-screen flex items-center justify-center text-viridian-600">Loading progress...</div>;
  }

  return (
    <div className="min-h-screen bg-white py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-pine-900 mb-4 text-center">Project Progress</h1>
        
        {propertiesWithMilestones.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-pine-600 mb-4">No construction updates are available at this time.</p>
            <Link to="/projects" className="text-viridian-600 hover:underline font-bold">Browse all projects</Link>
          </div>
        ) : (
          <>
            <p className="text-lg text-pine-600 text-center mb-8">Tracking the development milestones of our premium properties.</p>
            
            <div className="max-w-md mx-auto mb-16">
              <label className="block text-sm font-bold text-pine-900 mb-2 text-center uppercase tracking-wider">Select Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full p-4 bg-viridian-50 border-2 border-viridian-200 rounded-xl outline-none focus:border-viridian-500 font-bold text-pine-900 appearance-none text-center cursor-pointer shadow-sm hover:border-viridian-300 transition-colors"
              >
                {propertiesWithMilestones.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="relative border-l-2 border-viridian-200 ml-4 md:ml-8">
              {milestones.map((milestone, idx) => {
                const isCompleted = milestone.status === 'completed';
                const isCurrent = milestone.status === 'current';
                const isUpcoming = milestone.status === 'upcoming';
                
                const imagesToRender = milestone.images || (milestone.imageUrl ? [milestone.imageUrl] : []);

                return (
                  <div key={idx} className="mb-16 ml-8 md:ml-12 relative group">
                    {/* Node Icon */}
                    <span className={`absolute -left-[2.75rem] md:-left-[3.75rem] flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shadow-sm transition-transform duration-300 group-hover:scale-110 ${
                      isCompleted ? 'bg-viridian-600 text-white' : 
                      isCurrent ? 'bg-blue-600 text-white animate-pulse' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {isCompleted && <CheckCircle size={20} />}
                      {isCurrent && <Activity size={20} />}
                      {isUpcoming && <Calendar size={18} />}
                    </span>
                    
                    {/* Content Card */}
                    <div className={`bg-white rounded-2xl p-6 md:p-8 shadow-sm border transition-all duration-300 hover:shadow-md ${
                      isCompleted ? 'border-viridian-100' :
                      isCurrent ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-100 opacity-80'
                    }`}>
                      
                      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                        <span className="text-sm font-bold text-gray-500 tracking-wider uppercase flex items-center gap-2">
                          <Calendar size={14} className="text-gray-400" /> {milestone.date}
                        </span>
                        
                        {/* Status Badge */}
                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                          isCompleted ? 'bg-viridian-100 text-viridian-800' :
                          isCurrent ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isCompleted && <CheckCircle size={12} />}
                          {isCurrent && <Activity size={12} />}
                          {isUpcoming && <Calendar size={12} />}
                          {isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Upcoming'}
                        </div>
                      </div>

                      <h3 className="text-3xl font-serif text-pine-900 mb-3">{milestone.title}</h3>
                      <p className="text-pine-700 leading-relaxed text-lg mb-6">{milestone.description}</p>
                      
                      {/* Image Grid */}
                      {imagesToRender.length > 0 && (
                        <div className={`mt-6 mb-6 grid gap-4 ${imagesToRender.length > 1 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'}`}>
                          {imagesToRender.map((url, i) => (
                            <div key={i} className={`rounded-xl overflow-hidden border border-gray-100 shadow-sm ${imagesToRender.length === 1 ? 'max-h-[400px]' : 'h-48'}`}>
                              <img src={url} alt={`${milestone.title} image ${i+1}`} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Progress Bar for Current Status */}
                      {isCurrent && (
                        <div className="mt-8 bg-blue-50/50 p-5 rounded-xl border border-blue-100/50">
                          <div className="flex justify-between text-sm font-bold text-blue-900 mb-2 uppercase tracking-wide">
                            <span>Phase Completion</span>
                            <span>{milestone.percentage || 0}%</span>
                          </div>
                          <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${milestone.percentage || 0}%` }}>
                              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
