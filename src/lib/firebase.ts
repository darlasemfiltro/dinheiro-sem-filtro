export const auth = null;
export const db = null;
export const googleAuthProvider = null;
export const isDeviceOnline = () => true;
export const firebaseConnectionManager = {
  subscribe: () => () => {},
  getState: () => ({ status: 'offline' }),
  getLastStatus: () => null,
  testAndNotify: () => {},
  reconnectManual: async () => false
};
export type ConnectionState = any;
export type FirebaseStatus = any;

export const signInWithPopup = async (...args: any[]) => ({ user: {} });
export const signInWithEmailAndPassword = async (...args: any[]) => ({ user: {} });
export const createUserWithEmailAndPassword = async (...args: any[]) => ({ user: {} });
export const onAuthStateChanged = (...args: any[]) => () => {};
export const firebaseSignOut = async (...args: any[]) => {};
export const subscribeToUserFirestoreChanges = (...args: any[]) => () => {};
export const migrateLocalDataToFirestore = async (...args: any[]) => {};
export const fetchUserDataFromFirestore = async (...args: any[]) => null;
export const saveUserDataToFirestore = async (...args: any[]) => {};
export const pushUserToFirestore = async (...args: any[]) => {};
export const deleteUserFromFirestore = async (...args: any[]) => {};
export const pushAccountToFirestore = async (...args: any[]) => {};
export const deleteAccountFromFirestore = async (...args: any[]) => {};
export const pushCategoryToFirestore = async (...args: any[]) => {};
export const deleteCategoryFromFirestore = async (...args: any[]) => {};
export const pushGoalToFirestore = async (...args: any[]) => {};
export const deleteGoalFromFirestore = async (...args: any[]) => {};
export const pushTransactionToFirestore = async (...args: any[]) => {};
export const deleteTransactionFromFirestore = async (...args: any[]) => {};
export const pushFamilyMemberToFirestore = async (...args: any[]) => {};
export const deleteFamilyMemberFromFirestore = async (...args: any[]) => {};
export const pushSharedBudgetToFirestore = async (...args: any[]) => {};

export const pushPortfolioAssetToFirestore = async (...args: any[]) => {};
export const deletePortfolioAssetFromFirestore = async (...args: any[]) => {};
export const pushPortfolioTransactionToFirestore = async (...args: any[]) => {};
export const deletePortfolioTransactionFromFirestore = async (...args: any[]) => {};
export const pushPortfolioDividendToFirestore = async (...args: any[]) => {};
export const deletePortfolioDividendFromFirestore = async (...args: any[]) => {};
export const pushPortfolioGoalToFirestore = async (...args: any[]) => {};
export const deletePortfolioGoalFromFirestore = async (...args: any[]) => {};
export const fetchPortfolioDataFromFirestore = async (...args: any[]) => null;

