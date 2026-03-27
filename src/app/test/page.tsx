"use client"

import { useEffect, useState } from 'react';

const AccelerometerComponent = () => {
  const [acceleration, setAcceleration] = useState({ x: 0, y: 0, z: 0 } as { x: number | null; y: number | null; z: number | null });
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if the browser supports the DeviceMotionEvent
    if (!window.DeviceMotionEvent) {
      setError('DeviceMotionEvent is not supported by this browser.');
      return;
    }

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      if (event.acceleration) {
        setAcceleration({
          x: event.acceleration.x ?? 0,
          y: event.acceleration.y ?? 0,
          z: event.acceleration.z ?? 0,
        });
      }
    };

    // Request permissions for iOS 13+ devices
    const requestSensorPermission = async () => {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permissionState = await (DeviceOrientationEvent as any).requestPermission();
          if (permissionState === 'granted') {
            window.addEventListener('devicemotion', handleDeviceMotion);
          } else {
            setError('Permission not granted for device motion sensors.');
          }
        } catch (err) {
          setError(`Error requesting permission: ${err}`);
        }
      } else {
        // For non-iOS 13+ browsers, add the event listener directly
        window.addEventListener('devicemotion', handleDeviceMotion);
      }
    };
    
    // Call the permission request function
    requestSensorPermission();

    // Cleanup function to remove the event listener when the component unmounts
    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion);
    };
  }, []);

  return (
    <div>
      <h1>Accelerometer Data</h1>
      {error ? (
        <p>Error: {error}</p>
      ) : (
        <ul>
          <li>X-axis: {acceleration.x}</li>
          <li>Y-axis: {acceleration.y}</li>
          <li>Z-axis: {acceleration.z}</li>
        </ul>
      )}
    </div>
  );
};

export default AccelerometerComponent;
