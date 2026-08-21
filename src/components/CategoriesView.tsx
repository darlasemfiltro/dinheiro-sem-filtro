import React, { useState } from 'react';
import { Category, CategoryType, FamilyMember, RuleGroup, Subcategory } from '../types';
import { SEED_CATEGORIES } from '../services/storage';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  Tag,
  X,
  ChevronRight,
  Users,
  UserPlus,
  ArrowRightLeft,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Target,
  Wallet,
} from 'lucide-react';

// Recursive helper to insert a new subcategory into subcategory tree
const addSubcategoryToTree = (
  subs: Subcategory[],
  parentSubId: string | null,
  newSub: Subcategory
): Subcategory[] => {
  if (!parentSubId) {
    return [...subs, newSub];
  }
  return subs.map((s) => {
    if (s.id === parentSubId) {
      return {
        ...s,
        subcategories: [...(s.subcategories || []), newSub],
      };
    }
    if (s.subcategories && s.subcategories.length > 0) {
      return {
        ...s,
        subcategories: addSubcategoryToTree(s.subcategories, parentSubId, newSub),
      };
    }
    return s;
  });
};

// Recursive helper to delete a subcategory from tree
const deleteSubcategoryFromTree = (subs: Subcategory[], targetSubId: string): Subcategory[] => {
  return subs
    .filter((s) => s.id !== targetSubId)
    .map((s) => ({
      ...s,
      subcategories: s.subcategories ? deleteSubcategoryFromTree(s.subcategories, targetSubId) : [],
    }));
};

// Recursive helper to rename a subcategory in tree
const renameSubcategoryInTree = (
  subs: Subcategory[],
  targetSubId: string,
  newName: string
): Subcategory[] => {
  return subs.map((s) => {
    if (s.id === targetSubId) {
      return {
        ...s,
        name: newName,
      };
    }
    if (s.subcategories && s.subcategories.length > 0) {
      return {
        ...s,
        subcategories: renameSubcategoryInTree(s.subcategories, targetSubId, newName),
      };
    }
    return s;
  });
};

interface SubcategoryItemProps {
  sub: Subcategory;
  cat: Category;
  depth?: number;
  addingParentKey: string | null;
  setAddingParentKey: (key: string | null) => void;
  newSubName: string;
  setNewSubName: (val: string) => void;
  onAddSub: (cat: Category, parentSubId: string | null, name: string) => void;
  onRenameSub: (cat: Category, subId: string, newName: string) => void;
  onDeleteSub: (cat: Category, subId: string) => void;
  onStartMoveSub: (sub: Subcategory, sourceCat: Category) => void;
}

const SubcategoryItem: React.FC<SubcategoryItemProps> = ({
  sub,
  cat,
  depth = 0,
  addingParentKey,
  setAddingParentKey,
  newSubName,
  setNewSubName,
  onAddSub,
  onRenameSub,
  onDeleteSub,
  onStartMoveSub,
}) => {
  const currentKey = `sub_${sub.id}`;
  const isAddingChild = addingParentKey === currentKey;
  const childSubs = sub.subcategories || [];

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(sub.name);

  return (
    <div className={`space-y-1 ${depth > 0 ? 'ml-3 pl-2 border-l-2 border-gray-200' : ''}`}>
      {isEditing ? (
        <div className="flex items-center justify-between p-1.5 rounded-xl bg-amber-50/90 border border-[#D4AF37]/50 text-xs text-[#121212] transition">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
            <ChevronRight className="w-3 h-3 text-[#D4AF37] shrink-0" />
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-2 py-1 bg-white border border-[#D4AF37] rounded-lg text-xs font-bold text-[#121212] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (editName.trim()) {
                    onRenameSub(cat, sub.id, editName.trim());
                    setIsEditing(false);
                  }
                } else if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditName(sub.name);
                }
              }}
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (editName.trim()) {
                  onRenameSub(cat, sub.id, editName.trim());
                  setIsEditing(false);
                }
              }}
              className="px-2.5 py-1 bg-[#121212] text-[#D4AF37] font-extrabold text-[10px] rounded-lg hover:bg-black transition cursor-pointer"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setEditName(sub.name);
              }}
              className="p-1 text-gray-500 hover:bg-gray-200 rounded-lg cursor-pointer"
              title="Cancelar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-xs text-[#121212] transition">
          <div className="flex items-center gap-1.5 min-w-0">
            <ChevronRight className="w-3 h-3 text-[#D4AF37] shrink-0" />
            <span className="font-medium truncate">{sub.name}</span>
            {childSubs.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#D4AF37]/20 text-[#121212] font-extrabold shrink-0">
                {childSubs.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditName(sub.name);
                setIsEditing(true);
              }}
              title="Renomear subcategoria"
              className="p-1 text-gray-500 hover:text-[#121212] hover:bg-gray-200 rounded-lg transition text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <Edit2 className="w-3 h-3 text-[#D4AF37]" />
              <span className="hidden sm:inline text-[10px]">Editar</span>
            </button>
            <button
              type="button"
              onClick={() => onStartMoveSub(sub, cat)}
              title="Mover subcategoria para outra categoria"
              className="p-1 text-gray-500 hover:text-[#121212] hover:bg-gray-200 rounded-lg transition text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <ArrowRightLeft className="w-3 h-3 text-[#D4AF37]" />
              <span className="hidden sm:inline text-[10px]">Mover</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingParentKey(currentKey);
                setNewSubName('');
              }}
              title="Adicionar subcategoria interna"
              className="p-1 text-[#D4AF37] hover:text-[#121212] hover:bg-[#D4AF37]/10 rounded-lg transition text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span className="hidden sm:inline text-[10px]">Sub</span>
            </button>
            <button
              type="button"
              onClick={() => onDeleteSub(cat, sub.id)}
              title="Excluir subcategoria"
              className="p-1 text-gray-400 hover:text-[#FF3D00] hover:bg-[#FF3D00]/10 rounded-lg transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Input to add nested child subcategory */}
      {isAddingChild && (
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 ml-2 sm:ml-3 pl-2 border-l-2 border-[#D4AF37] py-1">
          <input
            type="text"
            value={newSubName}
            onChange={(e) => setNewSubName(e.target.value)}
            placeholder={`Nova subcategoria em "${sub.name}"...`}
            className="w-full sm:w-auto flex-1 min-w-[120px] px-3 py-1 bg-white border border-gray-300 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddSub(cat, sub.id, newSubName);
              }
            }}
          />
          <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
            <button
              type="button"
              onClick={() => onAddSub(cat, sub.id, newSubName)}
              className="py-1 px-3 bg-[#121212] text-[#D4AF37] font-extrabold text-xs rounded-xl hover:bg-black transition cursor-pointer"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setAddingParentKey(null)}
              className="p-1 text-gray-500 hover:bg-gray-100 rounded-xl cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Child subcategories recursively */}
      {childSubs.length > 0 && (
        <div className="space-y-1 mt-1">
          {childSubs.map((child) => (
            <SubcategoryItem
              key={child.id}
              sub={child}
              cat={cat}
              depth={depth + 1}
              addingParentKey={addingParentKey}
              setAddingParentKey={setAddingParentKey}
              newSubName={newSubName}
              setNewSubName={setNewSubName}
              onAddSub={onAddSub}
              onRenameSub={onRenameSub}
              onDeleteSub={onDeleteSub}
              onStartMoveSub={onStartMoveSub}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface CategoriesViewProps {
  categories: Category[];
  onSaveCategory: (category: Category) => void;
  onDeleteCategory: (id: string) => void;
  familyMembers?: FamilyMember[];
  onSaveFamilyMember?: (member: FamilyMember) => void;
  onDeleteFamilyMember?: (id: string) => void;
  userId: string;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  onSaveCategory,
  onDeleteCategory,
  familyMembers = [],
  onSaveFamilyMember,
  onDeleteFamilyMember,
  userId,
}) => {
  const [mainView, setMainView] = useState<'categories' | 'family'>('categories');
  const [ruleFilter, setRuleFilter] = useState<'all' | RuleGroup>('all');

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<CategoryType>('expense');
  const [categoryRuleGroup, setCategoryRuleGroup] = useState<RuleGroup>('50_essentials');
  const [categoryColor, setCategoryColor] = useState('#E11D48');

  // Subcategory Add State
  const [addingParentKey, setAddingParentKey] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');

  // Subcategory Move Modal State
  const [movingSubInfo, setMovingSubInfo] = useState<{ sub: Subcategory; sourceCat: Category } | null>(null);
  const [targetCatId, setTargetCatId] = useState<string>('');

  // Family Member Modal State
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberRelationship, setMemberRelationship] = useState('Titular');
  const [memberColor, setMemberColor] = useState('#E11D48');

  const [notification, setNotification] = useState<string | null>(null);

  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryType('expense');
    setCategoryRuleGroup('50_essentials');
    setCategoryColor('#E11D48');
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryType(cat.type);
    setCategoryRuleGroup(cat.ruleGroup || (cat.type === 'income' ? 'income' : '50_essentials'));
    setCategoryColor(cat.color);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    const catToSave: Category = {
      id: editingCategory ? editingCategory.id : `cat_${Date.now()}`,
      userId,
      name: categoryName.trim(),
      type: categoryType,
      ruleGroup: categoryType === 'income' ? 'income' : categoryRuleGroup,
      color: categoryColor,
      icon: 'Tag',
      subcategories: editingCategory ? editingCategory.subcategories : [],
    };

    onSaveCategory(catToSave);
    setIsCategoryModalOpen(false);
  };

  const handleAddSubcategory = (cat: Category, parentSubId: string | null, name: string) => {
    if (!name.trim()) return;

    const newSub: Subcategory = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      categoryId: cat.id,
      parentId: parentSubId || undefined,
      name: name.trim(),
      subcategories: [],
    };

    const updatedSubcategories = addSubcategoryToTree(cat.subcategories || [], parentSubId, newSub);

    const updatedCat: Category = {
      ...cat,
      subcategories: updatedSubcategories,
    };

    onSaveCategory(updatedCat);
    setNewSubName('');
    setAddingParentKey(null);
  };

  const handleRenameSubcategory = (cat: Category, subId: string, newName: string) => {
    if (!newName.trim()) return;

    const updatedSubcategories = renameSubcategoryInTree(cat.subcategories || [], subId, newName.trim());
    const updatedCat: Category = {
      ...cat,
      subcategories: updatedSubcategories,
    };

    onSaveCategory(updatedCat);
    setNotification(`Subcategoria renomeada para "${newName.trim()}"!`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteSubcategory = (cat: Category, subId: string) => {
    const updatedSubcategories = deleteSubcategoryFromTree(cat.subcategories || [], subId);
    const updatedCat: Category = {
      ...cat,
      subcategories: updatedSubcategories,
    };
    onSaveCategory(updatedCat);
  };

  // Subcategory Move Handler
  const handleStartMoveSub = (sub: Subcategory, sourceCat: Category) => {
    setMovingSubInfo({ sub, sourceCat });
    const firstOther = categories.find((c) => c.id !== sourceCat.id);
    setTargetCatId(firstOther ? firstOther.id : '');
  };

  const handleConfirmMoveSubcategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingSubInfo || !targetCatId) return;

    const { sub, sourceCat } = movingSubInfo;
    if (sourceCat.id === targetCatId) return;

    const targetCat = categories.find((c) => c.id === targetCatId);
    if (!targetCat) return;

    // Remove sub from source category
    const updatedSourceSubs = deleteSubcategoryFromTree(sourceCat.subcategories || [], sub.id);
    const updatedSourceCat: Category = {
      ...sourceCat,
      subcategories: updatedSourceSubs,
    };

    // Add sub to target category
    const movedSub: Subcategory = {
      ...sub,
      categoryId: targetCat.id,
      parentId: undefined,
    };
    const updatedTargetSubs = [...(targetCat.subcategories || []), movedSub];
    const updatedTargetCat: Category = {
      ...targetCat,
      subcategories: updatedTargetSubs,
    };

    onSaveCategory(updatedSourceCat);
    onSaveCategory(updatedTargetCat);
    setMovingSubInfo(null);

    setNotification(`Subcategoria "${sub.name}" movida com sucesso para "${targetCat.name}"!`);
    setTimeout(() => setNotification(null), 3500);
  };

  // Restore Default 50/30/20 Categories
  const handleRestoreDefaults = () => {
    if (window.confirm('Deseja carregar a estrutura de Categorias padrão com base na Regra 50 / 30 / 20 e Receitas?')) {
      SEED_CATEGORIES.forEach((cat) => {
        onSaveCategory({
          ...cat,
          userId,
        });
      });
      setNotification('Categorias padrão 50/30/20 restauradas com sucesso!');
      setTimeout(() => setNotification(null), 3500);
    }
  };

  // Family Member Handlers
  const handleOpenAddMember = () => {
    setEditingMember(null);
    setMemberName('');
    setMemberRelationship('Cônjuge');
    setMemberColor('#E11D48');
    setIsFamilyModalOpen(true);
  };

  const handleOpenEditMember = (member: FamilyMember) => {
    setEditingMember(member);
    setMemberName(member.name);
    setMemberRelationship(member.relationship || 'Titular');
    setMemberColor(member.color || '#E11D48');
    setIsFamilyModalOpen(true);
  };

  const handleSaveMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !onSaveFamilyMember) return;

    const memberToSave: FamilyMember = {
      id: editingMember ? editingMember.id : `fam_${Date.now()}`,
      userId,
      name: memberName.trim(),
      relationship: memberRelationship,
      color: memberColor,
    };

    onSaveFamilyMember(memberToSave);
    setIsFamilyModalOpen(false);
  };

  // Filter categories by rule group
  const filteredCategories = categories.filter((c) => {
    if (ruleFilter === 'all') return true;
    if (ruleFilter === 'income') return c.type === 'income' || c.ruleGroup === 'income';
    return c.ruleGroup === ruleFilter;
  });

  const getBadgeForCategory = (cat: Category) => {
    if (cat.type === 'income' || cat.ruleGroup === 'income') {
      return {
        label: 'Receita',
        bg: 'bg-[#00C853]/15 text-[#00E676] border-[#00C853]/40',
        icon: Wallet,
      };
    }
    switch (cat.ruleGroup) {
      case '50_essentials':
        return {
          label: '50% Essenciais',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: ShieldCheck,
        };
      case '30_lifestyle':
        return {
          label: '30% Estilo de Vida',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: Sparkles,
        };
      case '20_investment':
        return {
          label: '20% Reserva & Futuro',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: Target,
        };
      default:
        return {
          label: 'Despesa Geral',
          bg: 'bg-gray-100 text-gray-700 border-gray-200',
          icon: Tag,
        };
    }
  };

  return (
    <div className="space-y-6 pb-12" id="categories-view">
      {/* Toast Notification */}
      {notification && (
        <div className="bg-[#121212] text-[#D4AF37] border-2 border-[#D4AF37] p-4 rounded-2xl shadow-xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-5 h-5 text-[#00C853]" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            {mainView === 'categories' ? (
              <FolderTree className="w-5 h-5 text-[#D4AF37]" />
            ) : (
              <Users className="w-5 h-5 text-[#D4AF37]" />
            )}
            <h1 className="text-lg font-bold text-[#121212] font-serif">
              {mainView === 'categories' ? 'Categorias & Subcategorias (Regra 50/30/20)' : 'Membros da Família'}
            </h1>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {mainView === 'categories'
              ? 'Organize seu orçamento de acordo com a Regra 50/30/20 e crie, edite ou mova categorias e subcategorias livremente'
              : 'Cadastre os membros da família para controlar quem realizou cada lançamento'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* Main View Switcher */}
          <div className="flex bg-gray-100 p-1.5 rounded-2xl border-2 border-gray-200 w-full sm:w-auto gap-1">
            <button
              onClick={() => setMainView('categories')}
              className={`flex-1 sm:flex-initial px-4 py-2.5 text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 rounded-xl border-2 ${
                mainView === 'categories'
                  ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] font-black shadow-md'
                  : 'text-gray-700 hover:text-[#121212] border-transparent font-extrabold'
              }`}
            >
              <FolderTree className="w-4 h-4 text-[#D4AF37] stroke-[2.5]" />
              <span>Categorias</span>
            </button>
            <button
              onClick={() => setMainView('family')}
              className={`flex-1 sm:flex-initial px-4 py-2.5 text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 rounded-xl border-2 ${
                mainView === 'family'
                  ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] font-black shadow-md'
                  : 'text-gray-700 hover:text-[#121212] border-transparent font-extrabold'
              }`}
            >
              <Users className="w-4 h-4 text-[#D4AF37] stroke-[2.5]" />
              <span>Membros</span>
            </button>
          </div>

          {mainView === 'categories' ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleRestoreDefaults}
                title="Carregar Estrutura Padrão 50/30/20"
                className="min-h-[42px] sm:min-h-[44px] py-2 px-3 bg-gray-100 hover:bg-gray-200 text-[#121212] font-black text-xs rounded-xl border border-gray-300 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="hidden md:inline">Restaurar 50/30/20</span>
              </button>

              <button
                onClick={handleOpenAddCategory}
                className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-[44px] py-2.5 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer shrink-0 border border-[#00A843]"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Nova Categoria</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleOpenAddMember}
              className="w-full sm:w-auto min-h-[42px] sm:min-h-[44px] py-2.5 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer shrink-0 border border-[#00A843]"
            >
              <UserPlus className="w-4 h-4 stroke-[3]" />
              <span>Novo Membro</span>
            </button>
          )}
        </div>
      </div>

      {/* Main View 1: Categories & Subcategories */}
      {mainView === 'categories' && (
        <>
          {/* Rule 50/30/20 Filter Tabs */}
          <div className="flex flex-wrap bg-gray-100 p-2 rounded-2xl gap-2 w-full max-w-4xl border-2 border-gray-200">
            <button
              onClick={() => setRuleFilter('all')}
              className={`px-5 py-3 text-xs sm:text-sm font-black rounded-xl transition cursor-pointer border-2 min-h-[46px] ${
                ruleFilter === 'all'
                  ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                  : 'bg-white hover:bg-gray-200 text-gray-800 border-gray-300'
              }`}
            >
              Todas ({categories.length})
            </button>

            <button
              onClick={() => setRuleFilter('50_essentials')}
              className={`px-5 py-3 text-xs sm:text-sm font-black rounded-xl transition cursor-pointer flex items-center gap-2 border-2 min-h-[46px] ${
                ruleFilter === '50_essentials'
                  ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                  : 'bg-white hover:bg-gray-200 text-gray-800 border-gray-300'
              }`}
            >
              <ShieldCheck className="w-4.5 h-4.5 text-rose-500 stroke-[2.5]" />
              <span>50% Essenciais</span>
            </button>

            <button
              onClick={() => setRuleFilter('30_lifestyle')}
              className={`px-5 py-3 text-xs sm:text-sm font-black rounded-xl transition cursor-pointer flex items-center gap-2 border-2 min-h-[46px] ${
                ruleFilter === '30_lifestyle'
                  ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                  : 'bg-white hover:bg-gray-200 text-gray-800 border-gray-300'
              }`}
            >
              <Sparkles className="w-4.5 h-4.5 text-amber-500 stroke-[2.5]" />
              <span>30% Estilo de Vida</span>
            </button>

            <button
              onClick={() => setRuleFilter('20_investment')}
              className={`px-5 py-3 text-xs sm:text-sm font-black rounded-xl transition cursor-pointer flex items-center gap-2 border-2 min-h-[46px] ${
                ruleFilter === '20_investment'
                  ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                  : 'bg-white hover:bg-gray-200 text-gray-800 border-gray-300'
              }`}
            >
              <Target className="w-4.5 h-4.5 text-emerald-500 stroke-[2.5]" />
              <span>20% Reserva & Futuro</span>
            </button>

            <button
              onClick={() => setRuleFilter('income')}
              className={`px-5 py-3 text-xs sm:text-sm font-black rounded-xl transition cursor-pointer flex items-center gap-2 border-2 min-h-[46px] ${
                ruleFilter === 'income'
                  ? 'bg-[#00C853] text-[#121212] border-[#00A843] shadow-md'
                  : 'bg-white hover:bg-gray-200 text-gray-800 border-gray-300'
              }`}
            >
              <Wallet className="w-4.5 h-4.5 text-emerald-700 stroke-[2.5]" />
              <span>Receitas</span>
            </button>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((cat) => {
              const badge = getBadgeForCategory(cat);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={cat.id}
                  className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Category Header */}
                    <div className="flex items-start justify-between pb-3 border-b border-gray-100 gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <h3 className="text-sm font-bold text-[#121212] font-serif truncate">{cat.name}</h3>
                        </div>

                        {/* 50/30/20 Rule Badge */}
                        <div className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                          <BadgeIcon className="w-3 h-3 shrink-0" />
                          <span>{badge.label}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEditCategory(cat)}
                          title="Editar categoria"
                          className="p-1.5 text-gray-600 hover:text-[#121212] hover:bg-gray-100 rounded-xl transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteCategory(cat.id)}
                          title="Excluir categoria"
                          className="p-1.5 text-gray-400 hover:text-[#FF3D00] hover:bg-[#FF3D00]/10 rounded-xl transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Subcategories Tree List */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider block mb-1">
                        Subcategorias ({cat.subcategories.length})
                      </span>

                      {cat.subcategories.map((sub) => (
                        <SubcategoryItem
                          key={sub.id}
                          sub={sub}
                          cat={cat}
                          addingParentKey={addingParentKey}
                          setAddingParentKey={setAddingParentKey}
                          newSubName={newSubName}
                          setNewSubName={setNewSubName}
                          onAddSub={handleAddSubcategory}
                          onRenameSub={handleRenameSubcategory}
                          onDeleteSub={handleDeleteSubcategory}
                          onStartMoveSub={handleStartMoveSub}
                        />
                      ))}

                      {cat.subcategories.length === 0 && (
                        <p className="text-[11px] text-gray-400 italic py-1">Nenhuma subcategoria ainda.</p>
                      )}
                    </div>
                  </div>

                  {/* Add Top-Level Subcategory Trigger */}
                  <div className="pt-2">
                    {addingParentKey === `cat_${cat.id}` ? (
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                        <input
                          type="text"
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          placeholder="Nome da subcategoria..."
                          className="w-full sm:w-auto flex-1 min-w-[120px] px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSubcategory(cat, null, newSubName);
                            }
                          }}
                        />
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
                          <button
                            type="button"
                            onClick={() => handleAddSubcategory(cat, null, newSubName)}
                            className="py-1.5 px-3 bg-[#121212] text-[#D4AF37] font-bold text-xs rounded-xl hover:bg-black transition cursor-pointer"
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddingParentKey(null)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-xl cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAddingParentKey(`cat_${cat.id}`);
                          setNewSubName('');
                        }}
                        className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-[#121212] font-bold text-xs rounded-xl border border-gray-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                        Adicionar Subcategoria
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Main View 2: Family Members */}
      {mainView === 'family' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {familyMembers.map((member) => (
              <div
                key={member.id}
                className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-14 h-14 rounded-full sm:rounded-2xl flex items-center justify-center text-[#121212] font-black text-base sm:text-lg shadow-md border-2 border-[#121212] shrink-0"
                    style={{ backgroundColor: member.color || '#D4AF37' }}
                  >
                    {member.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#121212] font-serif">{member.name}</h3>
                    <span className="inline-block text-xs font-black text-[#121212] bg-[#D4AF37]/20 border border-[#D4AF37] px-2.5 py-0.5 rounded-full mt-0.5">
                      {member.relationship || 'Membro'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => handleOpenEditMember(member)}
                    className="p-2.5 text-gray-700 hover:text-[#121212] hover:bg-gray-100 rounded-xl transition cursor-pointer min-h-[40px] flex items-center gap-1 font-bold text-xs"
                    title="Editar Membro"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Editar</span>
                  </button>
                  {onDeleteFamilyMember && (
                    <button
                      onClick={() => onDeleteFamilyMember(member.id)}
                      className="p-2.5 text-red-600 hover:text-[#FF3D00] hover:bg-[#FF3D00]/10 rounded-xl transition cursor-pointer min-h-[40px] flex items-center gap-1 font-bold text-xs"
                      title="Excluir Membro"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Excluir</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {familyMembers.length === 0 && (
            <div className="text-center py-12 bg-white rounded-3xl border border-gray-200 p-6 space-y-3">
              <Users className="w-12 h-12 text-[#D4AF37] mx-auto" />
              <p className="text-sm font-bold text-[#121212]">Nenhum membro cadastrado ainda.</p>
              <button
                onClick={handleOpenAddMember}
                className="py-2 px-4 bg-[#121212] text-[#D4AF37] font-bold text-xs rounded-xl hover:bg-black transition cursor-pointer"
              >
                Adicionar Primeiro Membro
              </button>
            </div>
          )}
        </div>
      )}

      {/* Category Creation / Edit Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#D4AF37] rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base font-extrabold text-[#121212] font-serif">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 rounded-xl text-gray-500 hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategorySubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#121212] block mb-1">Nome da Categoria *</label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Ex: Alimentação, Moradia, Lazer..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#121212] block mb-1">Tipo de Lançamento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryType('expense');
                      if (categoryRuleGroup === 'income') setCategoryRuleGroup('50_essentials');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition ${
                      categoryType === 'expense'
                        ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37]'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryType('income');
                      setCategoryRuleGroup('income');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition ${
                      categoryType === 'income'
                        ? 'bg-[#00C853] text-[#121212] border-[#00A843] font-black'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Receita
                  </button>
                </div>
              </div>

              {/* Regra 50/30/20 Selector for Expenses */}
              {categoryType === 'expense' && (
                <div>
                  <label className="text-xs font-bold text-[#121212] block mb-1">
                    Classificação Regra 50 / 30 / 20
                  </label>
                  <div className="space-y-2">
                    <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                      categoryRuleGroup === '50_essentials' ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-400' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <input
                        type="radio"
                        name="ruleGroup"
                        checked={categoryRuleGroup === '50_essentials'}
                        onChange={() => setCategoryRuleGroup('50_essentials')}
                        className="mt-0.5 accent-rose-600"
                      />
                      <div>
                        <span className="text-xs font-extrabold text-rose-800 block">50% - Necessidades Básicas / Essenciais</span>
                        <span className="text-[10px] text-gray-600 block">Moradia, Aluguel, Feira, Luz, Água, Saúde e Transporte</span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                      categoryRuleGroup === '30_lifestyle' ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <input
                        type="radio"
                        name="ruleGroup"
                        checked={categoryRuleGroup === '30_lifestyle'}
                        onChange={() => setCategoryRuleGroup('30_lifestyle')}
                        className="mt-0.5 accent-amber-600"
                      />
                      <div>
                        <span className="text-xs font-extrabold text-amber-800 block">30% - Estilo de Vida & Desejos</span>
                        <span className="text-[10px] text-gray-600 block">Restaurantes, Viagens, Compras, Estética e Streaming</span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                      categoryRuleGroup === '20_investment' ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <input
                        type="radio"
                        name="ruleGroup"
                        checked={categoryRuleGroup === '20_investment'}
                        onChange={() => setCategoryRuleGroup('20_investment')}
                        className="mt-0.5 accent-emerald-600"
                      />
                      <div>
                        <span className="text-xs font-extrabold text-emerald-800 block">20% - Reserva & Futuro / Investimentos</span>
                        <span className="text-[10px] text-gray-600 block">Tesouro, CDB, Reserva de Emergência, Ações e Objetivos</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-[#121212] block mb-1">Cor de Identificação</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={categoryColor}
                    onChange={(e) => setCategoryColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200"
                  />
                  <span className="text-xs text-gray-700 font-mono">{categoryColor}</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl shadow-md transition cursor-pointer mt-2 border border-[#00A843]"
              >
                Salvar Categoria
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Subcategory Reassign / Move Modal */}
      {movingSubInfo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border-2 border-[#D4AF37] rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-[#D4AF37]" />
                <h2 className="text-base font-extrabold text-[#121212] font-serif">
                  Mover / Reatribuir Subcategoria
                </h2>
              </div>
              <button
                onClick={() => setMovingSubInfo(null)}
                className="p-1 rounded-xl text-gray-500 hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmMoveSubcategory} className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Subcategoria Selecionada:</span>
                <p className="text-sm font-extrabold text-[#121212]">{movingSubInfo.sub.name}</p>
                <span className="text-[11px] text-gray-600 block">
                  Categoria Atual: <strong>{movingSubInfo.sourceCat.name}</strong>
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-[#121212] block mb-1">
                  Selecione a Nova Categoria de Destino *
                </label>
                <select
                  value={targetCatId}
                  onChange={(e) => setTargetCatId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs text-[#121212] font-bold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  required
                >
                  <option value="" disabled>Escolha a categoria...</option>
                  {categories
                    .filter((c) => c.id !== movingSubInfo.sourceCat.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.type === 'income' ? '(Receita)' : c.ruleGroup ? `(${c.ruleGroup.replace('_', ' ')})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMovingSubInfo(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!targetCatId}
                  className="flex-1 py-2.5 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl shadow-md transition cursor-pointer border border-[#00A843] disabled:opacity-50"
                >
                  Confirmar Mudança
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Family Member Modal */}
      {isFamilyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#D4AF37] rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base font-extrabold text-[#121212] font-serif">
                {editingMember ? 'Editar Membro da Família' : 'Novo Membro da Família'}
              </h2>
              <button
                onClick={() => setIsFamilyModalOpen(false)}
                className="p-1 rounded-xl text-gray-500 hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMemberSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#121212] block mb-1">Nome do Membro *</label>
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Ex: Darla, Carlos, Sophia..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#121212] block mb-1">Relação / Papel</label>
                <select
                  value={memberRelationship}
                  onChange={(e) => setMemberRelationship(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                >
                  <option value="Titular">Titular</option>
                  <option value="Cônjuge">Cônjuge / Parceiro(a)</option>
                  <option value="Filho(a)">Filho(a)</option>
                  <option value="Dependente">Dependente</option>
                  <option value="Compartilhado">Compartilhado / Geral</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#121212] block mb-1">Cor de Destaque</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={memberColor}
                    onChange={(e) => setMemberColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200"
                  />
                  <span className="text-xs text-gray-700 font-mono">{memberColor}</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl shadow-md transition cursor-pointer mt-2 border border-[#00A843]"
              >
                Salvar Membro
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
