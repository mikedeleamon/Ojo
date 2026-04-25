import { StyleSheet, Image } from 'react-native';
import { View } from '../primitives';
import { colors } from '../../theme/tokens';

const Loading = () => (
  <View style={styles.root}>
    <Image
      source={require('../../assets/images/weatherIcons/Sunny.png')}
      style={styles.icon}
      resizeMode="contain"
    />
  </View>
);

export default Loading;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgDefault,
  },
  icon: { width: 80, height: 80 },
});
