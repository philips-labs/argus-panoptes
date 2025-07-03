/**
 * BaseTrafficLight Component
 *
 * A reusable traffic light component that displays a colored circle with a tooltip.
 * Used as the foundation for building various status indicators throughout the application.
 */
import { Box, Tooltip } from '@material-ui/core';

/**
 * Valid colors for the traffic light
 * - red: Indicates critical issues or failures
 * - green: Indicates successful status or good health
 * - yellow: Indicates warnings or items needing attention
 * - gray: Indicates neutral or disabled status
 * - white: Indicates empty or not applicable status
 */
type Color = 'red' | 'green' | 'yellow' | 'gray' | 'white';

/**
 * Props for the BaseTrafficLight component
 * @interface BaseTrafficLightProps
 * @property {Color} color - The color of the traffic light circle
 * @property {string} tooltip - Text displayed when hovering over the traffic light
 * @property {() => void} [onClick] - Optional click handler for interactive traffic lights
 */
interface BaseTrafficLightProps {
  color: Color;
  tooltip: string;
  onClick?: () => void;
}

/**
 * BaseTrafficLight component renders a colored circle with a tooltip
 *
 * @param {BaseTrafficLightProps} props - Component properties
 * @returns {JSX.Element} A traffic light indicator with tooltip
 */
export const BaseTrafficLight: React.FC<BaseTrafficLightProps> = ({
  color,
  tooltip,
  onClick,
}) => (
  <Tooltip title={tooltip} placement="right">
    <Box
      my={1} // Margin vertical 1 unit (8px by default in Material-UI)
      width={50} // Width of the circle in pixels
      height={50} // Height of the circle in pixels
      borderRadius="50%" // Makes the box a circle
      bgcolor={color} // Sets the background color from props
      onClick={onClick} // Optional click handler
      style={onClick ? { cursor: 'pointer' } : {}} // Shows pointer cursor if clickable
    />
  </Tooltip>
);
