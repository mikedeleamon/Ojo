import Sunny from '../../assets/images/weatherIcons/Sunny.png';
import { View, Text, Image } from '../../components/primitives';
import styles from './Loading.module.css';

const Loading = () => (
  <View style={styles.root}>
    <Image
      source={{ uri: Sunny }}
      style={styles.spin}
      resizeMode="contain"
      accessibilityLabel="Loading"
    />
    <Text style={styles.label}>Loading</Text>
  </View>
);

export default Loading;
