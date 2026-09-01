import { getCanonicalUserId } from './storage';
import {
  pushPortfolioAssetToFirestore,
  deletePortfolioAssetFromFirestore,
  pushPortfolioTransactionToFirestore,
  deletePortfolioTransactionFromFirestore,
  pushPortfolioDividendToFirestore,
  deletePortfolioDividendFromFirestore,
  pushPortfolioGoalToFirestore,
  deletePortfolioGoalFromFirestore,
  fetchPortfolioDataFromFirestore
} from '../lib/firebase';

export async function syncPortfolioFirestore(userId: string, localData: any, deletedIds: Set<string>) {
  const canonicalId = getCanonicalUserId(userId);
  
  // 1. Fetch from Firestore
  const firestoreData = await fetchPortfolioDataFromFirestore(canonicalId);
  if (!firestoreData) return null;

  // 2. Push local changes to Firestore
  for (const asset of localData.assets || []) {
    if (!deletedIds.has(asset.id) && !deletedIds.has(asset.ticker)) {
      await pushPortfolioAssetToFirestore(asset);
    } else {
      await deletePortfolioAssetFromFirestore(asset.id);
    }
  }
  for (const tx of localData.transactions || []) {
    if (!deletedIds.has(tx.id)) {
      await pushPortfolioTransactionToFirestore(tx);
    } else {
      await deletePortfolioTransactionFromFirestore(tx.id);
    }
  }
  for (const div of localData.dividends || []) {
    if (!deletedIds.has(div.id)) {
      await pushPortfolioDividendToFirestore(div);
    } else {
      await deletePortfolioDividendFromFirestore(div.id);
    }
  }
  for (const goal of localData.goals || []) {
    if (!deletedIds.has(goal.id)) {
      await pushPortfolioGoalToFirestore(goal);
    } else {
      await deletePortfolioGoalFromFirestore(goal.id);
    }
  }

  return firestoreData; // return the remote truth
}

export const syncPortfolioSupabase = syncPortfolioFirestore;

