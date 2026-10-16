import dechordIcon from "../../assets/dechord-mark.svg";

export function AppLogo() {
  return (
    <img
      className="app-logo"
      src={dechordIcon}
      width={24}
      height={24}
      alt=""
      draggable={false}
    />
  );
}
