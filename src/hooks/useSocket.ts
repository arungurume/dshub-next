import { useEffect } from 'react';
import { useSocketContext } from '@/context/SocketContext';

export const useSocket = (event?: string, callback?: (data: any) => void) => {
  const socketProps = useSocketContext();
  const { socket } = socketProps;

  useEffect(() => {
    if (!event || !callback || !socket) return;

    socket.on(event, callback);

    return () => {
      socket.off(event, callback);
    };
  }, [event, callback, socket]);

  return socketProps;
};
export default useSocket;
