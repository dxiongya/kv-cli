class Kv < Formula
  desc "Secure API key storage via macOS Keychain"
  homepage "https://github.com/dxiongya/kv-cli"
  url "https://github.com/dxiongya/kv-cli/archive/refs/tags/v2.0.0.tar.gz"
  sha256 ""
  license "MIT"

  depends_on "node"

  def install
    libexec.install "src", "bin", "package.json"
    bin.install_symlink libexec/"bin/kv"
  end

  test do
    assert_match "kv v#{version}", shell_output("#{bin}/kv version")
  end
end
