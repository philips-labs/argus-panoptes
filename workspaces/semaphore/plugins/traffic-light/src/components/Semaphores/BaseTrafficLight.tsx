// components/TrafficLights/BaseTrafficLight.tsx
import {FC } from 'react';
import { Box, Tooltip } from '@material-ui/core';

type Color = 'red' | 'green' | 'yellow' | 'gray' | 'white';

interface BaseTrafficLightProps {
  color: Color;
  tooltip: string;
  onClick?: () => void;
}

export const BaseTrafficLight: FC<BaseTrafficLightProps> = ({
  color,
  tooltip,
  onClick,
}) => (
  <Tooltip title={tooltip}>
    <div>
      <Box
        my={1}
        width={50}
        height={50}
        borderRadius="50%"
        bgcolor={color}
        onClick={onClick}
        style={onClick ? { cursor: 'pointer' } : {}}
      />
    </div>
  </Tooltip>
);
