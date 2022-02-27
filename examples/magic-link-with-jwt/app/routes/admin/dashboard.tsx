import { useUserContext } from '~/lib/useUserContext';

const DashboardRoute = (): JSX.Element => {
  const [user] = useUserContext();

  return (
    <>
      {!user ? <p>Loading...</p> : <pre>{JSON.stringify(user, null, 2)}</pre>}
    </>
  );
};

export default DashboardRoute;
