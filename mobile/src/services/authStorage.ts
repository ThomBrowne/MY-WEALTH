import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';

export const authStorage = {
  saveTokens: async (access: string, refresh: string) => {
    await AsyncStorage.multiSet([[ACCESS_KEY, access], [REFRESH_KEY, refresh]]);
  },
  getAccessToken: () => AsyncStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => AsyncStorage.getItem(REFRESH_KEY),
  clearTokens: async () => {
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
  },
};
