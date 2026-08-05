import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Terminal, 
  Clock, 
  Zap, 
  Play, 
  PlusCircle, 
  BookOpen,
  Lock,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { motion } from 'motion/react';
import { Lab, LabCategory, LabDifficulty, User } from '../types';
import { Button } from './ui/Button';
import { StatusBadge, Tag } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';

interface CatalogViewProps {
  labs: Lab[];
  onStartLab: (lab: Lab) => void;
  onOpenDetails: (lab: Lab) => void;
  user: User;
  onOpenCreateLab?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const CATEGORIES: (LabCategory | 'All')[] = [
  'All',
  'Smart Contracts',
  'DeFi Protocols',
  'NFTs & Digital Assets',
  'DAOs & Governance',
  'Cross-chain & L2s',
  'ZK & Privacy',
];

const DIFFICULTIES: (LabDifficulty | 'All')[] = ['All', 'Introductory', 'Intermediate', 'Advanced'];

type CompletionFilter = 'All' | 'Not Started' | 'In Progress' | 'Completed';
const COMPLETION_FILTERS: CompletionFilter[] = ['All', 'Not Started', 'In Progress', 'Completed'];

type ViewMode = 'grid' | 'modules';

export const CatalogView: React.FC<CatalogViewProps> = ({
  labs,
  onStartLab,
  onOpenDetails,
  user,
  onOpenCreateLab,
  searchQuery,
  setSearchQuery,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<LabCategory | 'All'>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<LabDifficulty | 'All'>('All');
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('All');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Filter labs
  const filteredLabs = labs.filter((lab) => {
    const matchesSearch = 
      lab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'All' || lab.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'All' || lab.difficulty === selectedDifficulty;

    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  // Group labs by category for module view
  const groupedLabs = CATEGORIES.filter(c => c !== 'All').reduce((acc, cat) => {
    const catLabs = filteredLabs.filter(l => l.category === cat);
    if (catLabs.length > 0) acc[cat] = catLabs;
    return acc;
  }, {} as Record<string, Lab[]>);

  const getLabStatusIndicator = (lab: Lab) => {
    if (lab.status === 'draft' || !lab.isPublished) {
      return <StatusBadge variant="warning">Draft</StatusBadge>;
    }
    if (lab.status === 'closed') {
      return <StatusBadge variant="danger">Closed</StatusBadge>;
    }
    if (lab.featured) {
      return <StatusBadge variant="solid">Featured</StatusBadge>;
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Header Title & Admin Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950 border border-zinc-800 p-6 rounded-3xl">
        <div>
          <div className="inline-flex items-center gap-1.5 text-zinc-400 text-xs font-mono font-bold uppercase mb-1">
            <BookOpen className="h-4 w-4 text-white" />
            <span>LABS CATALOG</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight font-heading">Interactive Web3 Labs</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Explore hands-on labs with smart contract verification, DeFi simulations, and ZK circuit building.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('modules')}
              className={`px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1 ${viewMode === 'modules' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
            >
              <Layers className="h-3 w-3" />
              Modules
            </button>
          </div>

          {user.role === 'admin' && onOpenCreateLab && (
            <Button
              variant="primary"
              size="md"
              icon={<PlusCircle className="h-4 w-4" />}
              onClick={onOpenCreateLab}
            >
              Create New Lab
            </Button>
          )}
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="space-y-4 bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by title, technology (e.g., Solidity, DeFi, NFT, ZK, Hardhat)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search labs"
            className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-white transition-all"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Filter className="h-4 w-4 text-zinc-500 shrink-0 mr-1" />
          {CATEGORIES.map((cat) => (
            <motion.button
              key={cat}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all font-mono ${
                selectedCategory === cat
                  ? 'bg-white text-black shadow-md'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100 border border-zinc-800'
              }`}
            >
              {cat}
            </motion.button>
          ))}
        </div>

        {/* Difficulty + Completion Filters */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-zinc-800 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Difficulty:</span>
            {DIFFICULTIES.map((diff) => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedDifficulty === diff
                    ? 'bg-zinc-800 text-white font-bold border border-zinc-600'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
          <div className="h-4 w-[1px] bg-zinc-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Status:</span>
            {COMPLETION_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setCompletionFilter(f)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  completionFilter === f
                    ? 'bg-zinc-800 text-white font-bold border border-zinc-600'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Module View */}
      {viewMode === 'modules' ? (
        <div className="space-y-8">
          {Object.entries(groupedLabs).map(([category, catLabs]) => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-white" />
                <h2 className="text-base font-bold text-white font-heading">{category}</h2>
                <StatusBadge variant="default">{catLabs.length} labs</StatusBadge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {catLabs.map((lab) => renderLabCard(lab))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLabs.map((lab) => renderLabCard(lab))}
        </div>
      )}

      {filteredLabs.length === 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl">
          <EmptyState
            title="No labs matched your search filters"
            description="Try clearing filters or search terms."
            actionLabel="Reset Filters"
            onAction={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedDifficulty('All');
              setCompletionFilter('All');
            }}
          />
        </div>
      )}
    </div>
  );

  function renderLabCard(lab: Lab) {
    const isDraft = lab.status === 'draft' || !lab.isPublished;
    const isLocked = !!lab.password || !!lab.accessCode;

    return (
      <motion.div
        key={lab.id}
        whileHover={{ y: -4 }}
        onClick={() => onOpenDetails(lab)}
        className={`group cursor-pointer bg-zinc-950 border border-zinc-800 hover:border-zinc-500 rounded-2xl overflow-hidden flex flex-col transition-all ${isDraft ? 'opacity-70' : ''}`}
      >
        {/* 1:1 Banner */}
        <div className="relative aspect-square bg-zinc-900 border-b border-zinc-800">
          {lab.bannerUrl ? (
            <img src={lab.bannerUrl} alt={lab.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />
          )}
          {/* Overlays */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span className="px-2.5 py-1 bg-black/80 border border-zinc-700 text-zinc-200 text-[10px] font-mono font-bold rounded-lg uppercase">
              {lab.category}
            </span>
          </div>
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {getLabStatusIndicator(lab)}
            {isLocked && (
              <div className="p-1.5 bg-black/80 border border-zinc-700 rounded-lg">
                <Lock className="h-3 w-3 text-zinc-300" />
              </div>
            )}
          </div>
        </div>

        <div className="p-5 flex flex-col flex-1">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-500">{lab.difficulty}</span>
            {lab.completions && lab.completions > 0 && (
              <span className="flex items-center gap-1 text-zinc-500 text-[10px]">
                <CheckCircle2 className="h-3 w-3" />
                {lab.completions} completions
              </span>
            )}
          </div>

          <h3 className="text-base font-bold text-white group-hover:text-zinc-200 transition-colors line-clamp-2 font-heading">
            {lab.title}
          </h3>

          <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
            {lab.description}
          </p>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {lab.tags.slice(0, 3).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                {lab.timeLimitMinutes ? `${lab.timeLimitMinutes}m` : 'Unlimited'}
              </span>
              <span className="flex items-center gap-1 text-white font-bold">
                <Zap className="h-3.5 w-3.5 text-white" />
                +{lab.xpReward} XP
              </span>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={<Play className="h-3 w-3 fill-current" />}
              onClick={(e) => {
                e.stopPropagation();
                onStartLab(lab);
              }}
            >
              Start Lab
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }
};
