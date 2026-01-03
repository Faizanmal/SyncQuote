import Toast from 'react-native-toast-message';

export const showToast = (
  type: 'success' | 'error' | 'info' | 'warning',
  title: string,
  message?: string
) => {
  Toast.show({
    type,
    text1: title,
    text2: message,
    visibilityTime: 4000,
    autoHide: true,
    topOffset: 60,
    bottomOffset: 40,
  });
};

export const hideToast = () => {
  Toast.hide();
};